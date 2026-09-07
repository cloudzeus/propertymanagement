"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getEffectiveSession } from "@/lib/auth-effective";
import { requirePermission } from "@/lib/rbac/permissions";
import { managerBuildingIds } from "@/lib/building-access";
import { sendNotificationEmail, brandedFrom } from "@/lib/mailgun";
import { getEmailBrand } from "@/lib/email-brand";
import { renderEmail, textToHtml, detailRows, escapeHtml } from "@/lib/email-template";
import { sendEmailWithAttachments } from "@/lib/mailgun";

export type InquiryInput = {
  supplierId: string;
  buildingId: string;
  maintenanceRequestId?: string | null;
  kind: "OFFER" | "APPOINTMENT";
  message: string;
  preferredDates?: string[]; // ISO datetimes, APPOINTMENT only
};

/**
 * PROPERTY_ADMIN → one of THEIR private suppliers (no login): emails the
 * request with the manager as Reply-To and records it. Company-registry
 * suppliers are never reachable this way — that's the RFQ flow.
 */
export async function createSupplierInquiry(input: InquiryInput) {
  await requirePermission("customer-suppliers", "edit");
  const eff = await getEffectiveSession();
  if (!eff?.user?.customerId) return { error: "Ο λογαριασμός σας δεν είναι συνδεδεμένος με πελάτη" };
  const customerId = eff.user.customerId;
  const supplier = await db.supplier.findFirst({ where: { id: input.supplierId, customerId, isActive: true }, select: { id: true, name: true, email: true, contactName: true } });
  if (!supplier) return { error: "Ο προμηθευτής δεν ανήκει στη λίστα σας" };
  if (!supplier.email) return { error: "Ο προμηθευτής δεν έχει email — προσθέστε το στην καρτέλα του" };
  const managed = await managerBuildingIds(eff.user.id);
  if (!managed.includes(input.buildingId)) return { error: "Δεν διαχειρίζεστε αυτό το κτήριο" };
  if (!input.message?.trim()) return { error: "Γράψτε τι χρειάζεστε" };
  const building = await db.building.findUnique({ where: { id: input.buildingId }, select: { name: true, address: true, city: true } });
  if (!building) return { error: "Δεν βρέθηκε το κτήριο" };
  let fault: { id: string; title: string; description: string; attachments: { url: string }[] } | null = null;
  if (input.maintenanceRequestId) {
    fault = await db.maintenanceRequest.findFirst({ where: { id: input.maintenanceRequestId, buildingId: input.buildingId }, select: { id: true, title: true, description: true, attachments: { select: { url: true }, take: 5 } } });
    if (!fault) return { error: "Η βλάβη δεν ανήκει στο κτήριο" };
  }
  const dates = (input.preferredDates ?? []).filter((d) => !isNaN(Date.parse(d))).slice(0, 5);
  if (input.kind === "APPOINTMENT" && dates.length === 0) return { error: "Δώστε τουλάχιστον μία προτεινόμενη ημερομηνία" };

  const row = await db.supplierInquiry.create({
    data: { supplierId: supplier.id, customerId, buildingId: input.buildingId, maintenanceRequestId: fault?.id ?? null, kind: input.kind, message: input.message.trim(), preferredDates: dates.length ? dates : undefined, sentTo: supplier.email, createdById: eff.user.id },
    select: { id: true },
  });

  const me = await db.user.findUnique({ where: { id: eff.user.id }, select: { name: true, email: true, phone: true } });
  const brand = await getEmailBrand();
  const isOffer = input.kind === "OFFER";
  const title = isOffer ? `Αίτημα προσφοράς — ${building.name}` : `Αίτημα ραντεβού — ${building.name}`;
  const fmtD = (iso: string) => new Date(iso).toLocaleString("el-GR", { dateStyle: "full", timeStyle: "short" });
  const html = renderEmail({
    title, brand, eyebrow: `Από τον διαχειριστή: ${me?.name ?? me?.email ?? ""}`,
    greeting: `Αγαπητέ/ή ${supplier.contactName ?? supplier.name},`,
    bodyHtml: `${textToHtml(input.message.trim())}${detailRows([
      ["Κτήριο", escapeHtml([building.name, building.address, building.city].filter(Boolean).join(", "))],
      fault ? ["Βλάβη", `${escapeHtml(fault.title)} — ${escapeHtml(fault.description.slice(0, 300))}`] : ["", null],
      isOffer ? ["Ζητείται", "Προσφορά με τιμή, χρόνο εκτέλεσης και διαθεσιμότητα"] : ["Προτεινόμενες ημερομηνίες", dates.map(fmtD).map(escapeHtml).join("<br>")],
      ["Επικοινωνία", escapeHtml([me?.name, me?.phone, me?.email].filter(Boolean).join(" · "))],
    ])}${fault?.attachments.length ? `<div style="display:flex;gap:6px;flex-wrap:wrap">${fault.attachments.map((a) => `<a href="${a.url}"><img src="${a.url}" width="120" style="border-radius:8px;border:1px solid rgba(27,28,26,.1)"></a>`).join("")}</div>` : ""}${textToHtml("Απαντήστε απευθείας σε αυτό το email — η απάντησή σας θα φτάσει στον διαχειριστή.")}`,
  });
  const sent = await sendEmailWithAttachments({ to: supplier.email, subject: title, html, from: brandedFrom(brand.name), replyTo: me?.email ?? undefined, tags: ["supplier-inquiry"], attachments: [] });
  if (!sent.success) {
    await db.supplierInquiry.delete({ where: { id: row.id } });
    return { error: "Το email δεν στάλθηκε — δοκιμάστε ξανά" };
  }
  // Copy to the manager so the thread lives in their mailbox too.
  if (me?.email) void sendNotificationEmail(me.email, `Στάλθηκε: ${title}`, `Το αίτημά σας προς ${supplier.name} (${supplier.email}) στάλθηκε. Όταν απαντήσει, καταγράψτε την απάντηση στη σελίδα «Οι προμηθευτές μου» για να μείνει στο ιστορικό.`, { href: "/building/suppliers", ctaLabel: "Οι προμηθευτές μου", tags: ["supplier-inquiry-copy"] });
  revalidatePath("/building/suppliers");
  return { id: row.id };
}

/** Manager records what the supplier answered (price / date) and closes the loop. */
export async function recordInquiryAnswer(id: string, answer: string, status: "ANSWERED" | "CLOSED") {
  await requirePermission("customer-suppliers", "edit");
  const eff = await getEffectiveSession();
  if (!eff?.user?.customerId) return { error: "Unauthorized" };
  const row = await db.supplierInquiry.findFirst({ where: { id, customerId: eff.user.customerId }, select: { id: true } });
  if (!row) return { error: "Δεν βρέθηκε" };
  await db.supplierInquiry.update({ where: { id }, data: { answer: answer.trim() || null, answeredAt: answer.trim() ? new Date() : undefined, status } });
  revalidatePath("/building/suppliers");
  return { ok: true };
}
