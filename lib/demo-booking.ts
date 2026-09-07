import "server-only";
import { db } from "@/lib/db";
import { renderEmail, detailRows, escapeHtml } from "@/lib/email-template";
import { sendEmailWithAttachments } from "@/lib/mailgun";

/** Booking window: business days, Athens time. */
const TZ = "Europe/Athens";
const DAYS_AHEAD = 14;
const SLOT_MINUTES = 30;
const FIRST_SLOT = { h: 10, m: 0 };
const LAST_SLOT = { h: 17, m: 30 }; // inclusive
const MIN_LEAD_MS = 2 * 60 * 60 * 1000; // no bookings closer than 2h from now

export type DemoSlotDay = { date: string; slots: { iso: string; time: string }[] };

/** UTC offset string (e.g. "+03:00") of the given calendar day in Athens. */
function athensOffset(ymd: string): string {
  const probe = new Date(`${ymd}T12:00:00Z`);
  const part = new Intl.DateTimeFormat("en-US", { timeZone: TZ, timeZoneName: "longOffset" })
    .formatToParts(probe)
    .find((p) => p.type === "timeZoneName")?.value; // "GMT+03:00"
  const m = part?.match(/GMT([+-]\d{2}:\d{2})/);
  return m ? m[1] : "+02:00";
}

function athensYmd(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
function athensWeekday(ymd: string): number {
  // 0=Sun..6=Sat of that calendar day in Athens (noon Athens is the same calendar day in UTC).
  return new Date(`${ymd}T12:00:00${athensOffset(ymd)}`).getUTCDay();
}

/** All bookable slots for the next DAYS_AHEAD days, minus taken and too-soon ones. */
export async function computeDemoSlots(): Promise<DemoSlotDay[]> {
  const now = new Date();
  const horizon = new Date(now.getTime() + DAYS_AHEAD * 24 * 3600 * 1000);
  const taken = await db.demoRequest.findMany({
    where: { scheduledAt: { gte: now, lte: horizon }, status: { not: "CANCELLED" } },
    select: { scheduledAt: true },
  });
  const takenIso = new Set(taken.map((t) => t.scheduledAt.toISOString()));

  const days: DemoSlotDay[] = [];
  for (let i = 0; i < DAYS_AHEAD; i++) {
    const ymd = athensYmd(new Date(now.getTime() + i * 24 * 3600 * 1000));
    const wd = athensWeekday(ymd);
    if (wd === 0 || wd === 6) continue; // weekends
    const off = athensOffset(ymd);
    const slots: { iso: string; time: string }[] = [];
    for (let mins = FIRST_SLOT.h * 60 + FIRST_SLOT.m; mins <= LAST_SLOT.h * 60 + LAST_SLOT.m; mins += SLOT_MINUTES) {
      const hh = String(Math.floor(mins / 60)).padStart(2, "0");
      const mm = String(mins % 60).padStart(2, "0");
      const d = new Date(`${ymd}T${hh}:${mm}:00${off}`);
      if (d.getTime() - now.getTime() < MIN_LEAD_MS) continue;
      if (takenIso.has(d.toISOString())) continue;
      slots.push({ iso: d.toISOString(), time: `${hh}:${mm}` });
    }
    if (slots.length) days.push({ date: ymd, slots });
  }
  return days;
}

function fmtAthens(d: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "el-GR", {
    timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(d);
}

function icsStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Calendar invite for the demo — attaching it makes the event land in Google/Outlook calendars. */
function buildIcs(opts: { id: string; start: Date; durationMin: number; requester: string; email: string; summary: string; description: string }): Buffer {
  const end = new Date(opts.start.getTime() + opts.durationMin * 60000);
  const lines = [
    "BEGIN:VCALENDAR",
    "PRODID:-//Orithon//Demo Booking//EL",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:demo-${opts.id}@orithon`,
    `DTSTAMP:${icsStamp(new Date())}`,
    `DTSTART:${icsStamp(opts.start)}`,
    `DTEND:${icsStamp(end)}`,
    `SUMMARY:${opts.summary}`,
    `DESCRIPTION:${opts.description.replace(/\n/g, "\\n")}`,
    `ATTENDEE;CN=${opts.requester};RSVP=FALSE:mailto:${opts.email}`,
    "STATUS:CONFIRMED",
    "BEGIN:VALARM",
    "TRIGGER:-PT15M",
    "ACTION:DISPLAY",
    "DESCRIPTION:Demo",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return Buffer.from(lines.join("\r\n"), "utf8");
}

/** Orithon-branded email shell (cream background, amber accent — matches the landing). */
function emailShell(title: string, inner: string): string {
  return renderEmail({ title, bodyHtml: inner });
}

const esc = escapeHtml;

export type DemoBookingInput = {
  name: string; email: string; phone?: string; company?: string; message?: string;
  slotIso: string; locale: string; consentText?: string;
};

export async function createDemoBooking(input: DemoBookingInput) {
  const start = new Date(input.slotIso);
  // The slot must still be one of the currently-offered ones (validates business hours, lead time, collisions).
  const days = await computeDemoSlots();
  const valid = days.some((d) => d.slots.some((s) => s.iso === start.toISOString()));
  if (!valid) return { ok: false as const, error: "SLOT_TAKEN" };

  const row = await db.demoRequest.create({
    data: {
      name: input.name.trim(),
      email: input.email.trim(),
      phone: input.phone?.trim() || null,
      company: input.company?.trim() || null,
      message: input.message?.trim() || null,
      consentText: input.consentText?.trim() || null,
      consentedAt: input.consentText?.trim() ? new Date() : null,
      scheduledAt: start,
      locale: input.locale === "en" ? "en" : "el",
    },
  });

  const when = { el: fmtAthens(start, "el"), en: fmtAthens(start, "en") };
  const ics = buildIcs({
    id: row.id, start, durationMin: row.durationMin,
    requester: row.name, email: row.email,
    summary: `Orithon demo — ${row.name}${row.company ? ` (${row.company})` : ""}`,
    description: `Παρουσίαση Orithon 30'.\nΌνομα: ${row.name}\nEmail: ${row.email}${row.phone ? `\nΤηλ: ${row.phone}` : ""}${row.message ? `\nΣημείωση: ${row.message}` : ""}`,
  });
  const icsAttachment = { filename: "orithon-demo.ics", content: ics, contentType: "text/calendar; method=REQUEST" };

  // 1) Confirmation to the requester (their language).
  const isEn = row.locale === "en";
  const requesterHtml = emailShell(
    isEn ? "Your Orithon demo is booked" : "Το demo σας κλείστηκε",
    `
    <p style="margin:0 0 6px;font-size:15px;line-height:1.6">${isEn ? `Hi ${esc(row.name)},` : `Γεια σας ${esc(row.name)},`}</p>
    <p style="margin:0;font-size:15px;line-height:1.6">${
      isEn
        ? "thank you for booking a walkthrough of Orithon. Here are the details:"
        : "ευχαριστούμε για το ενδιαφέρον σας στο Orithon. Τα στοιχεία του ραντεβού σας:"
    }</p>
    ${detailRows([
      [isEn ? "When" : "Πότε", `${isEn ? when.en : when.el}`],
      [isEn ? "Duration" : "Διάρκεια", "30′"],
      [isEn ? "Where" : "Πού", isEn ? "Online call — we'll send a link" : "Online κλήση — θα σας στείλουμε σύνδεσμο"],
    ])}
    <p style="margin:0;font-size:13.5px;color:rgba(27,28,26,.6);line-height:1.6">${
      isEn
        ? "The attached calendar file adds the appointment to your calendar. Need to reschedule? Just reply to this email."
        : "Το συνημμένο αρχείο προσθέτει το ραντεβού στο ημερολόγιό σας. Θέλετε αλλαγή; Απαντήστε σε αυτό το email."
    }</p>`,
  );

  // 2) Notify staff (managers & employees): email with the calendar invite + in-app notification.
  const staff = await db.user.findMany({
    where: { role: { in: ["SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE"] as any }, status: "ACTIVE" as any },
    select: { id: true, email: true },
  });
  const staffHtml = emailShell(
    "Νέο ραντεβού demo",
    `
    <p style="margin:0;font-size:15px;line-height:1.6">Νέα κράτηση παρουσίασης από τη σελίδα.</p>
    ${detailRows([
      ["Πότε", when.el],
      ["Όνομα", esc(row.name)],
      ["Email", esc(row.email)],
      ["Τηλέφωνο", esc(row.phone ?? "")],
      ["Εταιρεία", esc(row.company ?? "")],
      ["Σημείωση", esc(row.message ?? "")],
    ])}
    <p style="margin:0;font-size:13.5px;color:rgba(27,28,26,.6)">Το συνημμένο .ics προσθέτει το ραντεβού στο ημερολόγιό σας. Δείτε όλα τα ραντεβού στο Ημερολόγιο της εφαρμογής.</p>`,
  );

  const results = await Promise.allSettled([
    sendEmailWithAttachments({
      to: row.email,
      subject: isEn ? "Orithon — demo booked" : "Orithon — το demo σας κλείστηκε",
      html: requesterHtml,
      tags: ["demo-booking"],
      attachments: [icsAttachment],
    }),
    staff.length
      ? sendEmailWithAttachments({
          to: staff.map((s) => s.email),
          subject: `Νέο demo: ${row.name} — ${when.el}`,
          html: staffHtml,
          replyTo: row.email,
          tags: ["demo-booking-staff"],
          attachments: [icsAttachment],
        })
      : Promise.resolve({ success: true }),
    db.notification.createMany({
      data: staff.map((s) => ({
        userId: s.id,
        type: "DEMO_BOOKED",
        title: "Νέο ραντεβού demo",
        body: `${row.name}${row.company ? ` (${row.company})` : ""} — ${when.el}`,
        href: "/staff/calendar",
      })),
    }),
  ]);
  for (const r of results) if (r.status === "rejected") console.error("demo booking side-effect failed:", r.reason);

  return { ok: true as const, id: row.id, whenLabel: isEn ? when.en : when.el };
}

/** Demo appointments for the staff calendar (month window). */
export async function listDemoRequests(from: Date, to: Date) {
  return db.demoRequest.findMany({
    where: { scheduledAt: { gte: from, lte: to } },
    orderBy: { scheduledAt: "asc" },
  });
}
