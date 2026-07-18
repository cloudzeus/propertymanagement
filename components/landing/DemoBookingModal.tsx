"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useLocale } from "next-intl";
import { getDemoSlots, bookDemo } from "@/app/actions/demo-booking";
import { RiCloseLine, RiCalendarCheckLine, RiLoaderLine, RiCheckboxCircleLine } from "react-icons/ri";

type SlotDay = { date: string; slots: { iso: string; time: string }[] };

const T = {
  el: {
    title: "Κλείσε ένα demo 30′",
    sub: "Διάλεξε μέρα και ώρα — θα σου δείξουμε το Orithon στο δικό σου χαρτοφυλάκιο.",
    day: "Ημέρα", time: "Ώρα", details: "Τα στοιχεία σου",
    name: "Ονοματεπώνυμο *", email: "Email *", phone: "Τηλέφωνο", company: "Εταιρεία / Γραφείο",
    message: "Τι θα θέλατε να δείτε; (προαιρετικό)",
    submit: "Κλείσε το ραντεβού", submitting: "Κλείνουμε…",
    successTitle: "Κλείστηκε!", successBody: "Θα λάβεις email επιβεβαίωσης με πρόσκληση ημερολογίου.",
    close: "Κλείσιμο", errGeneric: "Κάτι πήγε στραβά — δοκίμασε ξανά.", errTaken: "Η ώρα μόλις κλείστηκε — διάλεξε άλλη.",
    loading: "Φόρτωση διαθεσιμότητας…", none: "Δεν υπάρχουν διαθέσιμες ώρες αυτή την περίοδο.",
  },
  en: {
    title: "Book a 30′ demo",
    sub: "Pick a day and time — we'll walk you through Orithon on your own portfolio.",
    day: "Day", time: "Time", details: "Your details",
    name: "Full name *", email: "Email *", phone: "Phone", company: "Company",
    message: "What would you like to see? (optional)",
    submit: "Book the demo", submitting: "Booking…",
    successTitle: "Booked!", successBody: "You'll receive a confirmation email with a calendar invite.",
    close: "Close", errGeneric: "Something went wrong — please try again.", errTaken: "That time was just taken — pick another.",
    loading: "Loading availability…", none: "No available times right now.",
  },
};

function dayLabel(ymd: string, locale: string): { top: string; bottom: string } {
  const d = new Date(`${ymd}T12:00:00`);
  const loc = locale === "en" ? "en-GB" : "el-GR";
  return {
    top: new Intl.DateTimeFormat(loc, { weekday: "short" }).format(d),
    bottom: new Intl.DateTimeFormat(loc, { day: "numeric", month: "short" }).format(d),
  };
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "11px 13px", borderRadius: 10, fontSize: 14.5,
  border: "1px solid rgba(27,28,26,.16)", background: "#fff", color: "#1b1c1a", outline: "none",
};

export function DemoBookingModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const locale = useLocale() === "en" ? "en" : "el";
  const t = T[locale];
  const [days, setDays] = useState<SlotDay[] | null>(null);
  const [dayIdx, setDayIdx] = useState(0);
  const [slotIso, setSlotIso] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", company: "", message: "", website: "" });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!open) return;
    setDone(null); setError(null); setSlotIso(null); setDayIdx(0); setDays(null);
    getDemoSlots().then(setDays).catch(() => setDays([]));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open, onClose]);

  const day = useMemo(() => (days && days.length ? days[Math.min(dayIdx, days.length - 1)] : null), [days, dayIdx]);
  const canSubmit = !!slotIso && form.name.trim().length >= 2 && /\S+@\S+\.\S+/.test(form.email) && !pending;

  function submit() {
    if (!canSubmit || !slotIso) return;
    setError(null);
    start(async () => {
      try {
        const res = await bookDemo({ ...form, slotIso, locale });
        if (res.ok) setDone(res.whenLabel);
        else if (res.error === "SLOT_TAKEN") { setError(t.errTaken); setSlotIso(null); setDays(await getDemoSlots()); }
        else setError(t.errGeneric);
      } catch {
        setError(t.errGeneric);
      }
    });
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(27,28,26,.45)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 560, maxHeight: "92vh", overflowY: "auto", background: "#F4F2EA", borderRadius: 22, border: "1px solid rgba(27,28,26,.12)", boxShadow: "0 44px 90px -30px rgba(27,28,26,.5)", padding: "28px 26px" }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-.02em", color: "#1b1c1a" }}>{t.title}</div>
            <div style={{ fontSize: 14, color: "rgba(27,28,26,.62)", marginTop: 5, lineHeight: 1.5 }}>{t.sub}</div>
          </div>
          <button type="button" onClick={onClose} aria-label={t.close} style={{ border: "1px solid rgba(27,28,26,.14)", background: "#fff", borderRadius: 10, padding: 7, cursor: "pointer", color: "#1b1c1a", lineHeight: 0 }}>
            <RiCloseLine size={18} />
          </button>
        </div>

        {done ? (
          <div style={{ textAlign: "center", padding: "42px 8px 30px" }}>
            <RiCheckboxCircleLine size={54} style={{ color: "#2E7D5B" }} />
            <div style={{ fontSize: 20, fontWeight: 800, marginTop: 12, color: "#1b1c1a" }}>{t.successTitle}</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 8, color: "#1b1c1a" }}>{done}</div>
            <div style={{ fontSize: 13.5, color: "rgba(27,28,26,.62)", marginTop: 8 }}>{t.successBody}</div>
            <button type="button" onClick={onClose} style={{ marginTop: 22, padding: "12px 26px", borderRadius: 12, border: "none", background: "#15161a", color: "#fff", fontWeight: 700, fontSize: 14.5, cursor: "pointer" }}>
              {t.close}
            </button>
          </div>
        ) : (
          <>
            {/* Day picker */}
            <div style={{ fontSize: 12.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", color: "rgba(27,28,26,.45)", margin: "22px 0 9px" }}>{t.day}</div>
            {!days ? (
              <div style={{ fontSize: 13.5, color: "rgba(27,28,26,.55)", display: "flex", alignItems: "center", gap: 8 }}><RiLoaderLine className="animate-spin" /> {t.loading}</div>
            ) : days.length === 0 ? (
              <div style={{ fontSize: 13.5, color: "rgba(27,28,26,.55)" }}>{t.none}</div>
            ) : (
              <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
                {days.map((d, i) => {
                  const l = dayLabel(d.date, locale);
                  const on = i === dayIdx;
                  return (
                    <button key={d.date} type="button" onClick={() => { setDayIdx(i); setSlotIso(null); }}
                      style={{ flex: "none", minWidth: 64, padding: "9px 10px", borderRadius: 12, cursor: "pointer", textAlign: "center",
                        border: on ? "1px solid #15161a" : "1px solid rgba(27,28,26,.14)",
                        background: on ? "#15161a" : "#fff", color: on ? "#fff" : "#1b1c1a" }}>
                      <div style={{ fontSize: 11.5, opacity: .75 }}>{l.top}</div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{l.bottom}</div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Time picker */}
            {day && (
              <>
                <div style={{ fontSize: 12.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", color: "rgba(27,28,26,.45)", margin: "18px 0 9px" }}>{t.time}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(74px,1fr))", gap: 8 }}>
                  {day.slots.map((s) => {
                    const on = slotIso === s.iso;
                    return (
                      <button key={s.iso} type="button" onClick={() => setSlotIso(s.iso)}
                        style={{ padding: "9px 0", borderRadius: 10, fontSize: 13.5, fontWeight: 600, cursor: "pointer",
                          border: on ? "1px solid #15161a" : "1px solid rgba(27,28,26,.14)",
                          background: on ? "#15161a" : "#fff", color: on ? "#fff" : "#1b1c1a" }}>
                        {s.time}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {/* Details */}
            <div style={{ fontSize: 12.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", color: "rgba(27,28,26,.45)", margin: "20px 0 9px" }}>{t.details}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <input style={inputStyle} placeholder={t.name} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input style={inputStyle} placeholder={t.email} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <input style={inputStyle} placeholder={t.phone} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <input style={inputStyle} placeholder={t.company} value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
            </div>
            <textarea style={{ ...inputStyle, marginTop: 10, minHeight: 74, resize: "vertical" }} placeholder={t.message} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
            {/* Honeypot — invisible to humans */}
            <input style={{ position: "absolute", left: -9999, opacity: 0, height: 0 }} tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="website" />

            {error && <div style={{ marginTop: 12, fontSize: 13.5, color: "#C0392B" }}>{error}</div>}

            <button type="button" disabled={!canSubmit} onClick={submit}
              style={{ marginTop: 18, width: "100%", padding: "14px 0", borderRadius: 12, border: "none", cursor: canSubmit ? "pointer" : "default",
                background: canSubmit ? "#15161a" : "rgba(27,28,26,.25)", color: "#fff", fontWeight: 700, fontSize: 15,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
                boxShadow: canSubmit ? "0 14px 30px -16px rgba(21,22,26,.55)" : "none" }}>
              {pending ? <RiLoaderLine className="animate-spin" size={17} /> : <RiCalendarCheckLine size={17} />}
              {pending ? t.submitting : t.submit}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** Mounts the modal and opens it for any click on a link whose href ends in "#demo". */
export function DemoModalHost() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const a = (e.target as HTMLElement).closest?.("a[href$='#demo']");
      if (a) { e.preventDefault(); setOpen(true); }
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  return <DemoBookingModal open={open} onClose={() => setOpen(false)} />;
}
