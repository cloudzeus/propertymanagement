"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormField, FieldInput, FieldTextarea } from "@/components/ui/modal";
import { createRfq, cancelRfq, forwardOffer, scheduleWorkOrder, resendRfqInvitation, addRfqSuppliers } from "@/app/actions/rfq";
import {
  RFQ_STATUS_LABELS, INVITATION_STATE_LABELS, INVITATION_STATE_COLORS, OFFER_STATUS_LABELS, WO_STATUS_LABELS, WO_STATUS_COLORS, eur, applyMarkup, withVat,
  type RfqDTO, type OfferDTO, type WorkOrderDTO, type RfqCandidateDTO,
} from "@/lib/rfq-shared";
import { RfqSupplierPicker } from "@/components/suppliers/RfqSupplierPicker";
import { RiMoneyEuroCircleLine, RiSendPlaneLine, RiFileTextLine, RiCalendarCheckLine, RiCloseLine, RiStarFill, RiMailSendLine, RiUserAddLine } from "react-icons/ri";

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("el-GR", { dateStyle: "short", timeStyle: "short" }) : "—");
const fmtD = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("el-GR") : "—");

/**
 * Company-side offers panel on a fault: work orders, RFQs with their offers
 * (forward one with markup), and the "send RFQ" form. Only staff see this.
 */
export type RfqPickerData = { candidates: RfqCandidateDTO[]; categories: { id: string; name: string }[]; defaultCategoryId: string | null };

export function RfqPanel({ requestId, handledBy, rfqs, workOrders, defaults, picker, canCreate = true }: {
  requestId: string; handledBy: string; rfqs: RfqDTO[]; workOrders: WorkOrderDTO[];
  defaults: { markupPct: number; warrantyMonths: number }; picker: RfqPickerData; canCreate?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [addSel, setAddSel] = useState<Set<string>>(new Set());
  async function run(fn: () => Promise<{ error?: string | null } | { ok?: boolean } | { id?: string }>) {
    setBusy(true); setError(null); setInfo(null);
    const res = await fn();
    setBusy(false);
    if (res && "error" in res && res.error) { setError(res.error); return false; }
    if (res && "sent" in res) setInfo(sentMessage(res as { sent: number; noEmail?: string[]; failed?: string[] }, picker.candidates));
    router.refresh();
    return true;
  }
  const active = rfqs.filter((r) => !["CANCELLED", "EXPIRED", "DECLINED"].includes(r.status));

  return (
    <div style={card}>
      <div style={h3}><RiMoneyEuroCircleLine /> Προσφορές & σύμβαση έργου</div>
      {error && <div style={{ color: "var(--destructive)", fontSize: "var(--fs-13)", marginBottom: 10 }}>{error}</div>}
      {info && <div style={{ color: "#15803d", fontSize: "var(--fs-13)", marginBottom: 10 }}>{info}</div>}

      {workOrders.map((w) => <WorkOrderRow key={w.id} w={w} busy={busy} run={run} />)}

      {rfqs.map((r) => (
        <div key={r.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 14, marginBottom: 12, opacity: ["CANCELLED", "EXPIRED"].includes(r.status) ? 0.6 : 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <b style={{ fontSize: "var(--fs-13-5)" }}>Αίτημα προσφοράς · {fmt(r.createdAt)}</b>
            <span style={pill}>{RFQ_STATUS_LABELS[r.status] ?? r.status}</span>
            {r.deadlineAt && <span style={{ fontSize: "var(--fs-12)", color: "var(--muted-foreground)" }}>προθεσμία {fmt(r.deadlineAt)}</span>}
            {r.surveyRequired && <span style={pill}>με αυτοψία</span>}
            <span style={{ flex: 1 }} />
            {["OPEN", "OFFERED"].includes(r.status) && canCreate && <button disabled={busy} style={btn} onClick={() => { setAdding(adding === r.id ? null : r.id); setAddSel(new Set()); }}><RiUserAddLine /> Προσθήκη συνεργατών</button>}
            {["OPEN", "OFFERED"].includes(r.status) && <button disabled={busy} style={btn} onClick={() => confirm("Ακύρωση αιτήματος προσφοράς;") && run(() => cancelRfq(r.id))}><RiCloseLine /> Ακύρωση</button>}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            {r.invitations.map((i) => {
              const color = INVITATION_STATE_COLORS[i.state];
              const who = i.recipients.length ? i.recipients.map((x) => `${x.email}${x.openedAt ? ` (άνοιξε ${fmt(x.openedAt)})` : ""}`).join(", ") : "Κανένας παραλήπτης email";
              const canResend = ["OPEN", "OFFERED"].includes(r.status) && ["NOT_SENT", "SENT", "OPENED", "NO_EMAIL"].includes(i.state);
              return (
                <span key={i.supplierId} style={{ ...pill, color, borderColor: `${color}55`, background: `${color}10` }} title={i.declineReason ?? `${who}${i.emailCount ? ` · ${i.emailCount}× email, τελευταίο ${fmt(i.lastEmailAt)}` : ""}`}>
                  {i.supplierName} · {INVITATION_STATE_LABELS[i.state]}
                  {canResend && <button type="button" disabled={busy} title="Αποστολή email ξανά" onClick={() => run(() => resendRfqInvitation(i.id))} style={{ border: "none", background: "none", color, cursor: "pointer", padding: 0, display: "inline-flex", marginLeft: 2 }}><RiMailSendLine /></button>}
                </span>
              );
            })}
          </div>
          {adding === r.id && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px dashed var(--border)", display: "flex", flexDirection: "column", gap: 8 }}>
              <RfqSupplierPicker candidates={picker.candidates} categories={picker.categories} defaultCategoryId={picker.defaultCategoryId} selected={addSel} onChange={setAddSel} excludeIds={r.invitations.map((i) => i.supplierId)} />
              <div><button style={btnPrimary} disabled={busy || addSel.size === 0} onClick={async () => { if (await run(() => addRfqSuppliers(r.id, [...addSel]))) { setAdding(null); setAddSel(new Set()); } }}><RiSendPlaneLine /> Αποστολή σε {addSel.size} επιπλέον</button></div>
            </div>
          )}
          {r.offers.length > 0 && (
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
              {r.offers.map((o) => <OfferRow key={o.id} o={o} rfqStatus={r.status} handledBy={handledBy} defaults={defaults} busy={busy} run={run} alreadyForwarded={workOrders.some((w) => w.status !== "DECLINED" && w.status !== "CANCELLED")} />)}
            </div>
          )}
          {r.notes && <p style={{ fontSize: "var(--fs-12)", color: "var(--muted-foreground)", margin: "8px 0 0" }}>Σημείωση: {r.notes}</p>}
        </div>
      ))}

      {canCreate && active.length === 0 && workOrders.every((w) => ["DECLINED", "CANCELLED", "CONFIRMED"].includes(w.status)) && (
        <NewRfqForm requestId={requestId} picker={picker} busy={busy} run={run} />
      )}
    </div>
  );
}

function WorkOrderRow({ w, busy, run }: { w: WorkOrderDTO; busy: boolean; run: (fn: () => Promise<{ error?: string | null } | { ok?: boolean }>) => Promise<boolean> }) {
  const [when, setWhen] = useState("");
  const color = WO_STATUS_COLORS[w.status] ?? "#6b7280";
  return (
    <div style={{ border: `1px solid ${color}55`, background: `${color}0a`, borderRadius: 10, padding: 14, marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <b style={{ fontSize: "var(--fs-14)" }}>{w.number}</b>
        <span style={{ ...pill, color, borderColor: `${color}55` }}>{WO_STATUS_LABELS[w.status] ?? w.status}</span>
        {w.covered && <span style={pill}>καλύπτεται από σύμβαση</span>}
        <span style={{ flex: 1 }} />
        <Link href={`/admin/work-orders/${w.id}/contract/customer`} style={link}><RiFileTextLine /> Σύμβαση Α (πελάτης)</Link>
        <Link href={`/admin/work-orders/${w.id}/contract/supplier`} style={link}><RiFileTextLine /> Σύμβαση Β (συνεργάτης)</Link>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8, marginTop: 10, fontSize: "var(--fs-12-5)" }}>
        <Kv k="Συνεργάτης" v={w.supplierName ?? "—"} />
        <Kv k="Τιμή συνεργάτη" v={`${eur(w.supplierPrice)} + ΦΠΑ`} />
        <Kv k="Τιμή πελάτη" v={w.covered ? "0,00 € (καλύπτεται)" : `${eur(w.customerPrice)} + ΦΠΑ ${w.vatPct}% = ${eur(withVat(w.customerPrice, w.vatPct))}`} />
        <Kv k="Περιθώριο" v={w.markupPct != null ? `${w.markupPct}% · ${eur(w.customerPrice - (w.supplierPrice ?? 0))}` : "—"} />
        <Kv k="Αποδοχή πελάτη" v={w.customerAcceptedAt ? fmt(w.customerAcceptedAt) : w.customerDeclinedAt ? `Απόρριψη ${fmt(w.customerDeclinedAt)}${w.customerDeclineReason ? ` — ${w.customerDeclineReason}` : ""}` : "εκκρεμεί"} />
        <Kv k="Αποδοχή συνεργάτη" v={w.supplierAcceptedAt ? fmt(w.supplierAcceptedAt) : "εκκρεμεί"} />
        <Kv k="Ραντεβού" v={fmt(w.scheduledAt)} />
        <Kv k="Παραλαβή" v={w.customerConfirmedAt ? `Επιβεβαιώθηκε ${fmt(w.customerConfirmedAt)}` : w.status === "DISPUTED" ? `Αμφισβήτηση: ${w.disputeNote}` : w.completedAt ? `Ολοκληρώθηκε ${fmt(w.completedAt)} — αναμένει πελάτη` : "—"} />
      </div>
      {["ACCEPTED", "SCHEDULED"].includes(w.status) && (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginTop: 10, maxWidth: 420 }}>
          <div style={{ flex: 1 }}><FormField label={w.scheduledAt ? "Αλλαγή ραντεβού" : "Ορισμός ημερομηνίας επισκευής"}><FieldInput type="datetime-local" value={when} onChange={setWhen} /></FormField></div>
          <button disabled={busy || !when} style={btn} onClick={() => run(() => scheduleWorkOrder(w.id, new Date(when).toISOString()))}><RiCalendarCheckLine /> Ορισμός</button>
        </div>
      )}
      {w.completionMedia.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
          {w.completionMedia.map((m, i) => <a key={i} href={m.url} target="_blank" rel="noreferrer"><img src={m.url} alt="" style={{ width: 84, height: 64, objectFit: "cover", borderRadius: 6, border: "1px solid var(--border)" }} /></a>)}
        </div>
      )}
    </div>
  );
}

function OfferRow({ o, rfqStatus, handledBy, defaults, busy, run, alreadyForwarded }: { o: OfferDTO; rfqStatus: string; handledBy: string; defaults: { markupPct: number; warrantyMonths: number }; busy: boolean; run: (fn: () => Promise<{ error?: string | null } | { id?: string }>) => Promise<boolean>; alreadyForwarded: boolean }) {
  const [open, setOpen] = useState(false);
  const [markup, setMarkup] = useState(String(defaults.markupPct));
  const [covered, setCovered] = useState(handledBy === "COMPANY");
  const [price, setPrice] = useState(String(applyMarkup(o.amount, defaults.markupPct)));
  const [message, setMessage] = useState("");
  const canForward = o.status === "SUBMITTED" && ["OPEN", "OFFERED"].includes(rfqStatus) && !alreadyForwarded;
  const setMk = (v: string) => { setMarkup(v); const m = Number(v); if (Number.isFinite(m)) setPrice(String(applyMarkup(o.amount, m))); };
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px", background: o.status === "SELECTED" ? "#15803d0a" : "var(--card)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: "var(--fs-13)" }}>
        <b>{o.supplierName}</b>
        {o.supplierRating != null && <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "#b45309", fontSize: "var(--fs-12)" }}><RiStarFill /> {o.supplierRating.toFixed(1)} ({o.supplierRatingCount})</span>}
        <span style={{ fontWeight: 700 }}>{eur(o.amount)} <span style={{ fontWeight: 400, color: "var(--muted-foreground)" }}>+ ΦΠΑ {o.vatPct}%</span></span>
        {o.surveyFee != null && o.surveyFee > 0 && <span style={{ color: "var(--muted-foreground)" }}>αυτοψία {eur(o.surveyFee)}{o.surveyWaived ? " (συμψηφίζεται)" : ""}</span>}
        <span style={{ color: "var(--muted-foreground)" }}>από {fmtD(o.earliestDate)} · ισχύει έως {fmtD(o.validUntil)}{o.estimatedMinutes ? ` · ~${o.estimatedMinutes}′` : ""}</span>
        <span style={pill}>{OFFER_STATUS_LABELS[o.status] ?? o.status}</span>
        <span style={{ flex: 1 }} />
        {canForward && <button style={btnPrimary} disabled={busy} onClick={() => setOpen((v) => !v)}><RiSendPlaneLine /> Προώθηση στον πελάτη</button>}
      </div>
      {o.description && <p style={{ fontSize: "var(--fs-12-5)", color: "var(--muted-foreground)", margin: "6px 0 0", whiteSpace: "pre-wrap" }}>{o.description}</p>}
      {open && canForward && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px dashed var(--border)", display: "flex", flexDirection: "column", gap: 10 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "var(--fs-13)", cursor: "pointer" }}>
            <input type="checkbox" checked={covered} onChange={(e) => setCovered(e.target.checked)} /> Καλύπτεται από τη σύμβαση διαχείρισης — χωρίς χρέωση/αποδοχή πελάτη, άμεση ανάθεση
          </label>
          {!covered && (
            <div style={{ display: "grid", gridTemplateColumns: "120px 160px 1fr", gap: 10, alignItems: "end" }}>
              <FormField label="Περιθώριο %"><FieldInput type="number" value={markup} onChange={setMk} /></FormField>
              <FormField label="Τιμή πελάτη (καθ.)"><FieldInput type="number" value={price} onChange={setPrice} /></FormField>
              <div style={{ fontSize: "var(--fs-12-5)", color: "var(--muted-foreground)", paddingBottom: 8 }}>
                Ο πελάτης θα δει <b style={{ color: "var(--foreground)" }}>{eur(Number(price) || 0)} + ΦΠΑ = {eur(withVat(Number(price) || 0, o.vatPct))}</b> · κέρδος {eur((Number(price) || 0) - o.amount)}
              </div>
            </div>
          )}
          <FormField label="Μήνυμα προς τον πελάτη (προαιρετικά)"><FieldTextarea value={message} onChange={setMessage} rows={2} placeholder="π.χ. Περιλαμβάνει υλικά και εργασία· εγγύηση 6 μήνες." /></FormField>
          <div><button style={btnPrimary} disabled={busy} onClick={() => run(() => forwardOffer(o.id, { markupPct: Number(markup), customerPrice: Number(price), message, covered, warrantyMonths: defaults.warrantyMonths }))}><RiSendPlaneLine /> {covered ? "Ανάθεση χωρίς χρέωση" : "Αποστολή προσφοράς στον πελάτη"}</button></div>
        </div>
      )}
    </div>
  );
}

/** "Στάλθηκε σε 3 παραλήπτες · χωρίς email: Χ, Υ" after a send. */
export function sentMessage(res: { sent: number; noEmail?: string[]; failed?: string[] }, candidates: RfqCandidateDTO[]): string {
  const names = (res.noEmail ?? []).map((id) => candidates.find((c) => c.id === id)?.name ?? id);
  const parts = [res.sent === 0 ? "Δεν στάλθηκε κανένα email." : `Στάλθηκε email σε ${res.sent} παραλήπτ${res.sent === 1 ? "η" : "ες"}.`];
  if (res.failed?.length) parts.push(`Απέτυχε η αποστολή σε: ${res.failed.join(", ")} — δοκιμάστε «Αποστολή ξανά».`);
  if (names.length) parts.push(`Χωρίς διεύθυνση email: ${names.join(", ")} — προσθέστε επαφή με email στην καρτέλα τους.`);
  return parts.join(" ");
}

function NewRfqForm({ requestId, picker, busy, run }: { requestId: string; picker: RfqPickerData; busy: boolean; run: (fn: () => Promise<{ error?: string | null } | { id?: string }>) => Promise<boolean> }) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [deadline, setDeadline] = useState("");
  const [survey, setSurvey] = useState(false);
  const [notes, setNotes] = useState("");
  return (
    <div style={{ borderTop: "1px dashed var(--border)", paddingTop: 12 }}>
      <div style={{ fontSize: "var(--fs-13)", fontWeight: 700, marginBottom: 6 }}>Νέο αίτημα προσφοράς σε συνεργάτες</div>
      <p style={{ fontSize: "var(--fs-12-5)", color: "var(--muted-foreground)", margin: "0 0 8px" }}>Η λίστα είναι ταξινομημένη κατά καταλληλότητα. Κάθε συνεργάτης λαμβάνει email με προσωπικό link (14 ημέρες) και απαντά με τιμή και διαθεσιμότητα.</p>
      <RfqSupplierPicker candidates={picker.candidates} categories={picker.categories} defaultCategoryId={picker.defaultCategoryId} selected={sel} onChange={setSel} />
      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 10, marginTop: 10, alignItems: "end" }}>
        <FormField label="Προθεσμία απάντησης"><FieldInput type="datetime-local" value={deadline} onChange={setDeadline} /></FormField>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "var(--fs-13)", cursor: "pointer", paddingBottom: 8 }}>
          <input type="checkbox" checked={survey} onChange={(e) => setSurvey(e.target.checked)} /> Ζητείται αυτοψία πριν την προσφορά
        </label>
      </div>
      <FormField label="Σημείωση προς τους συνεργάτες (προαιρετικά)"><FieldTextarea value={notes} onChange={setNotes} rows={2} /></FormField>
      <div style={{ marginTop: 8 }}>
        <button style={btnPrimary} disabled={busy || sel.size === 0} onClick={() => run(() => createRfq({ maintenanceRequestId: requestId, supplierIds: [...sel], deadlineAt: deadline ? new Date(deadline).toISOString() : null, surveyRequired: survey, notes }))}>
          <RiSendPlaneLine /> Αποστολή σε {sel.size} συνεργάτ{sel.size === 1 ? "η" : "ες"}
        </button>
      </div>
    </div>
  );
}

function Kv({ k, v }: { k: string; v: string }) {
  return <div><div style={{ fontSize: "var(--fs-11)", color: "var(--muted-foreground)", fontWeight: 600 }}>{k}</div><div style={{ color: "var(--foreground)" }}>{v}</div></div>;
}

const card: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 18 };
const h3: React.CSSProperties = { fontSize: "var(--fs-13)", fontWeight: 700, color: "var(--foreground)", margin: "0 0 12px", display: "flex", alignItems: "center", gap: 6 };
const pill: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 4, fontSize: "var(--fs-11)", fontWeight: 700, padding: "2px 8px", borderRadius: 999, border: "1px solid var(--border)", background: "var(--paper)", color: "var(--foreground)" };
const btn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, height: 32, padding: "0 12px", border: "1px solid var(--border)", background: "var(--paper)", borderRadius: "var(--radius-sm)", fontSize: "var(--fs-12-5)", fontWeight: 600, cursor: "pointer", color: "var(--foreground)" };
const btnPrimary: React.CSSProperties = { ...btn, background: "var(--primary)", color: "var(--primary-foreground)", border: "none" };
const link: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 4, fontSize: "var(--fs-12)", color: "var(--color-primary)", textDecoration: "none" };
