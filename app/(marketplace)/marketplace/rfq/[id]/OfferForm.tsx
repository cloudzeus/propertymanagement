"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FormField, FieldInput, FieldTextarea } from "@/components/ui/modal";
import { submitOffer, declineRfq } from "@/app/actions/rfq";
import { RFQ_STATUS_LABELS, eur, withVat } from "@/lib/rfq-shared";
import { PRIORITY_LABELS } from "@/lib/maintenance-shared";
import { RiSendPlaneLine, RiCloseLine, RiCheckLine, RiMapPin2Line, RiAlarmWarningLine } from "react-icons/ri";

type Rfq = { id: string; title: string; description: string; status: string; deadlineAt: string | null; surveyRequired: boolean; building: string; category: string | null; priority: string | null; restrictedAccess: boolean; attachments: { url: string; kind: string }[] };
type Offer = { id: string; amount: number; vatPct: number; surveyFee: number | null; surveyWaived: boolean; description: string | null; estimatedMinutes: number | null; earliestDate: string | null; validUntil: string | null; status: string } | null;

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("el-GR", { dateStyle: "long", timeStyle: "short" }) : "—");
const toInput = (iso: string | null) => (iso ? iso.slice(0, 10) : "");
const plus = (days: number) => { const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };

export function OfferForm({ rfq, invitation, myOffer, defaults }: { rfq: Rfq; invitation: { status: string; declineReason: string | null }; myOffer: Offer; canOffer: boolean; defaults: { surveyFee: number | null; surveyWaived: boolean } }) {
  const router = useRouter();
  const [amount, setAmount] = useState(myOffer ? String(myOffer.amount) : "");
  const [vat, setVat] = useState(String(myOffer?.vatPct ?? 24));
  const [survey, setSurvey] = useState(myOffer?.surveyFee != null ? String(myOffer.surveyFee) : defaults.surveyFee != null ? String(defaults.surveyFee) : "");
  const [surveyWaived, setSurveyWaived] = useState(myOffer?.surveyWaived ?? defaults.surveyWaived);
  const [description, setDescription] = useState(myOffer?.description ?? "");
  const [minutes, setMinutes] = useState(myOffer?.estimatedMinutes ? String(myOffer.estimatedMinutes) : "");
  const [earliest, setEarliest] = useState(toInput(myOffer?.earliestDate ?? null) || plus(2));
  const [valid, setValid] = useState(toInput(myOffer?.validUntil ?? null) || plus(30));
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const open = ["OPEN", "OFFERED"].includes(rfq.status) && invitation.status !== "DECLINED";
  const net = Number(amount.replace(",", ".")) || 0;

  async function run(fn: () => Promise<{ error?: string | null } | { ok?: boolean }>, okMsg: string) {
    setBusy(true); setError(null);
    const res = await fn();
    setBusy(false);
    if (res && "error" in res && res.error) { setError(res.error); return; }
    setDone(okMsg); router.refresh();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <h1 style={{ fontSize: "var(--fs-19)", fontWeight: 700, margin: 0, flex: 1 }}>{rfq.title}</h1>
          <span style={pill}>{RFQ_STATUS_LABELS[rfq.status] ?? rfq.status}</span>
          {rfq.priority && <span style={pill}>{PRIORITY_LABELS[rfq.priority as keyof typeof PRIORITY_LABELS] ?? rfq.priority}</span>}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, fontSize: "var(--fs-12-5)", color: "var(--muted-foreground)", marginTop: 6 }}>
          <span><RiMapPin2Line style={{ verticalAlign: "-2px" }} /> {rfq.building}</span>
          {rfq.category && <span>Κατηγορία: {rfq.category}</span>}
          {rfq.deadlineAt && <span>Προθεσμία: {fmt(rfq.deadlineAt)}</span>}
          {rfq.surveyRequired && <span><RiAlarmWarningLine style={{ verticalAlign: "-2px" }} /> Ζητείται αυτοψία</span>}
          {rfq.restrictedAccess && <span>Χρειάζεται ραντεβού πρόσβασης</span>}
        </div>
        <p style={{ fontSize: "var(--fs-14)", marginTop: 12, whiteSpace: "pre-wrap" }}>{rfq.description}</p>
        {rfq.attachments.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {rfq.attachments.map((a, i) => a.kind === "VIDEO" ? <video key={i} src={a.url} controls style={{ width: 200, borderRadius: 8 }} /> : <a key={i} href={a.url} target="_blank" rel="noreferrer"><img src={a.url} alt="" style={{ width: 120, height: 90, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)" }} /></a>)}
          </div>
        )}
      </div>

      <div style={card}>
        <div style={{ fontSize: "var(--fs-13)", fontWeight: 700, marginBottom: 10 }}>{myOffer ? "Η προσφορά σας" : "Η προσφορά σας"}</div>
        {done && <div style={{ padding: "8px 12px", borderRadius: 6, background: "#15803d14", color: "#15803d", fontSize: "var(--fs-13)", marginBottom: 10 }}><RiCheckLine style={{ verticalAlign: "-2px" }} /> {done}</div>}
        {error && <div style={{ color: "var(--destructive)", fontSize: "var(--fs-13)", marginBottom: 10 }}>{error}</div>}
        {invitation.status === "DECLINED" && <p style={{ margin: 0, fontSize: "var(--fs-13)", color: "var(--muted-foreground)" }}>Δηλώσατε ότι δεν ενδιαφέρεστε{invitation.declineReason ? ` («${invitation.declineReason}»)` : ""}.</p>}
        {myOffer && myOffer.status !== "SUBMITTED" && <p style={{ margin: "0 0 10px", fontSize: "var(--fs-13)", color: myOffer.status === "SELECTED" ? "#15803d" : "var(--muted-foreground)", fontWeight: 600 }}>{myOffer.status === "SELECTED" ? "Η προσφορά σας επιλέχθηκε — θα ενημερωθείτε για την ανάθεση." : myOffer.status === "REJECTED" ? "Επιλέχθηκε άλλη προσφορά αυτή τη φορά." : "Αποσύρθηκε."}</p>}
        {open && (!myOffer || myOffer.status === "SUBMITTED") && !declining && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ margin: 0, fontSize: "var(--fs-12-5)", color: "var(--muted-foreground)" }}>Δώστε καθαρή τιμή για ολόκληρη την εργασία (υλικά + εργασία). Η εταιρεία διαχείρισης προσθέτει το δικό της περιθώριο προς τον πελάτη — δεν χρειάζεται να το υπολογίσετε εσείς.</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 1fr", gap: 10 }}>
              <FormField label="Τιμή (καθαρή, €)" required><FieldInput type="number" value={amount} onChange={setAmount} placeholder="π.χ. 180" /></FormField>
              <FormField label="ΦΠΑ %"><FieldInput type="number" value={vat} onChange={setVat} /></FormField>
              <div style={{ alignSelf: "end", paddingBottom: 8, fontSize: "var(--fs-13)", color: "var(--muted-foreground)" }}>Σύνολο με ΦΠΑ: <b style={{ color: "var(--foreground)" }}>{eur(withVat(net, Number(vat) || 0))}</b></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <FormField label="Νωρίτερη ημερομηνία έναρξης"><FieldInput type="date" value={earliest} onChange={setEarliest} /></FormField>
              <FormField label="Η προσφορά ισχύει έως"><FieldInput type="date" value={valid} onChange={setValid} /></FormField>
              <FormField label="Εκτιμώμενη διάρκεια (λεπτά)"><FieldInput type="number" value={minutes} onChange={setMinutes} placeholder="π.χ. 120" /></FormField>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 10, alignItems: "end", background: "var(--paper)", borderRadius: 8, padding: "10px 12px" }}>
              <FormField label="Χρέωση αυτοψίας (€)" hint="κενό = δωρεάν"><FieldInput type="number" value={survey} onChange={setSurvey} /></FormField>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "var(--fs-13)", cursor: "pointer", paddingBottom: 8 }}><input type="checkbox" checked={surveyWaived} onChange={(e) => setSurveyWaived(e.target.checked)} /> Συμψηφίζεται αν μου ανατεθεί η εργασία</label>
            </div>
            <FormField label="Τι περιλαμβάνει η προσφορά" hint="Υλικά, εργασίες, εξαιρέσεις. Το βλέπει η εταιρεία διαχείρισης."><FieldTextarea value={description} onChange={setDescription} rows={3} placeholder="π.χ. Αντικατάσταση αυτόματου 16A, έλεγχος γραμμής, 2 ώρες εργασία. Δεν περιλαμβάνει μπογιάτισμα." /></FormField>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button disabled={busy || net <= 0} style={btnPrimary} onClick={() => run(() => submitOffer(rfq.id, { amount: net, vatPct: Number(vat), surveyFee: survey.trim() ? Number(survey) : null, surveyWaived, description, estimatedMinutes: minutes ? Number(minutes) : null, earliestDate: earliest || null, validUntil: valid || null }), myOffer ? "Η προσφορά ενημερώθηκε." : "Η προσφορά στάλθηκε στην εταιρεία διαχείρισης.")}><RiSendPlaneLine /> {myOffer ? "Ενημέρωση προσφοράς" : "Αποστολή προσφοράς"}</button>
              {!myOffer && <button disabled={busy} style={btn} onClick={() => setDeclining(true)}><RiCloseLine /> Δεν ενδιαφέρομαι</button>}
            </div>
          </div>
        )}
        {declining && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 520 }}>
            <FieldTextarea value={reason} onChange={setReason} rows={2} placeholder="Λόγος (προαιρετικά): π.χ. εκτός περιοχής, χωρίς διαθεσιμότητα" />
            <div style={{ display: "flex", gap: 8 }}>
              <button disabled={busy} style={btnPrimary} onClick={() => run(() => declineRfq(rfq.id, reason), "Ενημερώσαμε την εταιρεία ότι δεν θα δώσετε προσφορά.")}>Επιβεβαίωση</button>
              <button disabled={busy} style={btn} onClick={() => setDeclining(false)}>Άκυρο</button>
            </div>
          </div>
        )}
        {!open && !myOffer && invitation.status !== "DECLINED" && <p style={{ margin: 0, fontSize: "var(--fs-13)", color: "var(--muted-foreground)" }}>Το αίτημα έχει κλείσει.</p>}
      </div>
    </div>
  );
}

const card: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 18 };
const pill: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 4, fontSize: "var(--fs-11)", fontWeight: 700, padding: "2px 8px", borderRadius: 999, border: "1px solid var(--border)", background: "var(--paper)", color: "var(--foreground)" };
const btn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, height: 38, padding: "0 14px", border: "1px solid var(--border)", background: "var(--paper)", borderRadius: "var(--radius-sm)", fontSize: "var(--fs-13)", fontWeight: 600, cursor: "pointer", color: "var(--foreground)" };
const btnPrimary: React.CSSProperties = { ...btn, background: "var(--primary)", color: "var(--primary-foreground)", border: "none" };
