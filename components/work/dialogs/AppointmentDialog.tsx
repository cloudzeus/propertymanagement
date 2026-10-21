"use client";

import { useState } from "react";
import { RiCalendarCheckLine, RiDeleteBinLine } from "react-icons/ri";
import { FormField, FieldInput, FieldSelect } from "@/components/ui/modal";
import { scheduleRequest, setRequestEstimate, offerSlots, bookSlot, removeSlot } from "@/app/actions/maintenance-requests";
import { combineLocal, roundTo30, TIME_OPTIONS } from "@/lib/work/appointment";
import { DialogFrame, useDialogRun, btn, btnPrimary, muted, checkRow, fmt, type DialogProps } from "./shared";

const tab: React.CSSProperties = { padding: "8px 12px", border: "none", borderBottom: "2px solid transparent", background: "transparent", cursor: "pointer", fontSize: "var(--fs-13)", fontWeight: 600, color: "var(--muted-foreground)", fontFamily: "inherit" };
const tabActive: React.CSSProperties = { ...tab, color: "var(--foreground)", borderBottomColor: "var(--primary)" };

export function AppointmentDialog({ ctx, subject, onDone, onClose }: DialogProps) {
  const f = ctx.fault;
  const [mode, setMode] = useState<"direct" | "slots">("direct");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [duration, setDuration] = useState(String(f?.estimatedMinutes ?? 60));
  const [presence, setPresence] = useState(f?.managerPresence ?? false);
  const [slotDate, setSlotDate] = useState("");
  const [slotTime, setSlotTime] = useState("09:00");
  const { busy, error, run } = useDialogRun(onDone);
  if (!f) return null;

  const iso = combineLocal(date, time);
  const mins = roundTo30(Number(duration), f.estimatedMinutes ?? 60);
  const openSlots = f.slots.filter((s) => s.status === "OPEN");

  const schedule = () => run(async () => {
    if (mins !== (f.estimatedMinutes ?? null) || presence !== f.managerPresence) {
      const est = await setRequestEstimate(subject.id, mins, presence);
      if ("error" in est && est.error) return est;
    }
    return scheduleRequest(subject.id, iso!, mins);
  }, `Ορίστηκε ραντεβού ${fmt(iso)}`);

  return (
    <DialogFrame title="Ραντεβού" width={600} error={error} busy={busy} onClose={onClose}
      primary={mode === "direct" ? { label: "Ορισμός ραντεβού", onClick: schedule, disabled: !iso } : undefined}>
      <p style={muted}>{f.title}{f.restrictedAccess ? " · Περιορισμένη πρόσβαση" : ""}</p>
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)" }}>
        <button type="button" style={mode === "direct" ? tabActive : tab} onClick={() => setMode("direct")}>Ορισμός ραντεβού</button>
        <button type="button" style={mode === "slots" ? tabActive : tab} onClick={() => setMode("slots")}>Διαθεσιμότητα (slots)</button>
      </div>

      {mode === "direct" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <FormField label="Ημερομηνία" required><FieldInput type="date" value={date} onChange={setDate} /></FormField>
            <FormField label="Ώρα" required><FieldSelect value={time} onChange={setTime} options={TIME_OPTIONS.map((t) => ({ value: t, label: t }))} /></FormField>
            <FormField label="Διάρκεια (λεπτά)"><FieldInput type="number" value={duration} onChange={setDuration} placeholder="60" /></FormField>
          </div>
          <label style={checkRow}><input type="checkbox" checked={presence} onChange={(e) => setPresence(e.target.checked)} style={{ marginTop: 3 }} /><span>Παρουσία διαχειριστή</span></label>
          <p style={muted}>Η βλάβη γίνεται «Προγραμματισμένη» και ειδοποιούνται οι ενδιαφερόμενοι.</p>
        </>
      )}

      {mode === "slots" && (
        <>
          <p style={muted}>Κάθε πλευρά δηλώνει διαθέσιμα slots 30 λεπτών — η άλλη επιλέγει ένα για να κλειστεί το ραντεβού.</p>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div style={{ width: 160 }}><FormField label="Ημερομηνία"><FieldInput type="date" value={slotDate} onChange={setSlotDate} /></FormField></div>
            <div style={{ width: 120 }}><FormField label="Ώρα (30′)"><FieldSelect value={slotTime} onChange={setSlotTime} options={TIME_OPTIONS.map((t) => ({ value: t, label: t }))} /></FormField></div>
            <button type="button" disabled={busy || !combineLocal(slotDate, slotTime)} style={btn} onClick={() => run(() => offerSlots(subject.id, [combineLocal(slotDate, slotTime)!]), "Η διαθεσιμότητα δηλώθηκε")}>Δήλωση διαθεσιμότητας</button>
          </div>
          {openSlots.length === 0 ? <p style={muted}>Δεν υπάρχουν ανοιχτά slots.</p> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {openSlots.map((s) => (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "var(--fs-13)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "6px 10px" }}>
                  <span style={{ fontWeight: 600 }}>{fmt(s.startAt)}</span>
                  <span style={muted}>{s.side === "COMPANY" ? "Εταιρία" : "Διαχειριστής"}{s.offeredByName ? ` · ${s.offeredByName}` : ""}</span>
                  <span style={{ flex: 1 }} />
                  {s.side !== "COMPANY"
                    ? <button type="button" disabled={busy} style={btnPrimary} onClick={() => run(() => bookSlot(s.id), `Κλείστηκε ραντεβού ${fmt(s.startAt)}`)}><RiCalendarCheckLine /> Κλείσιμο ραντεβού</button>
                    : <button type="button" disabled={busy} aria-label="Διαγραφή slot" style={{ ...btn, color: "var(--destructive)" }} onClick={() => run(() => removeSlot(s.id), "Το slot διαγράφηκε")}><RiDeleteBinLine /></button>}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {f.appointments.length > 0 && (
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
          {f.appointments.map((a) => (
            <div key={a.id} style={{ fontSize: "var(--fs-13)", color: "var(--foreground)", display: "flex", gap: 8, alignItems: "center" }}>
              <RiCalendarCheckLine style={{ color: "#15803d" }} /> Ραντεβού: {fmt(a.startAt)} – {new Date(a.endAt).toLocaleTimeString("el-GR", { timeStyle: "short", timeZone: "Europe/Athens" })}
              {a.managerPresence && <span style={muted}>(με παρουσία διαχειριστή)</span>}
            </div>
          ))}
        </div>
      )}
    </DialogFrame>
  );
}
