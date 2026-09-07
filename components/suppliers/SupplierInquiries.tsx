"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Modal, FormField, FieldInput, FieldTextarea, FieldSelect } from "@/components/ui/modal";
import { createSupplierInquiry, recordInquiryAnswer } from "@/app/actions/supplier-inquiries";
import { RiSendPlaneLine, RiMoneyEuroCircleLine, RiCalendarCheckLine, RiCheckLine, RiMailSendLine, RiAddLine, RiCloseLine } from "react-icons/ri";

export type InquiryDTO = {
  id: string; kind: string; status: string; message: string; preferredDates: string[]; sentTo: string; answer: string | null; answeredAt: string | null; createdAt: string;
  supplierId: string; supplierName: string; buildingName: string; faultId: string | null; faultTitle: string | null;
};

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("el-GR", { dateStyle: "short", timeStyle: "short" }) : "—");
const KIND: Record<string, string> = { OFFER: "Προσφορά", APPOINTMENT: "Ραντεβού" };
const STATUS: Record<string, { label: string; color: string }> = { SENT: { label: "Στάλθηκε", color: "#CA5D00" }, ANSWERED: { label: "Απαντήθηκε", color: "#2E7D5B" }, CLOSED: { label: "Έκλεισε", color: "#6b7280" } };

/** "Ask for offer / appointment" to one of the manager's own suppliers (email-only, no login). */
export function InquiryModal({ supplier, kind, buildings, faults, onClose, onDone }: {
  supplier: { id: string; name: string; email: string | null }; kind: "OFFER" | "APPOINTMENT";
  buildings: { id: string; name: string }[]; faults: { id: string; title: string; buildingId: string }[];
  onClose: () => void; onDone: () => void;
}) {
  const [buildingId, setBuildingId] = useState(buildings[0]?.id ?? "");
  const [faultId, setFaultId] = useState("");
  const [message, setMessage] = useState(kind === "OFFER" ? "Θα θέλαμε προσφορά για την παρακάτω εργασία. Παρακαλώ στείλτε τιμή, χρόνο εκτέλεσης και διαθεσιμότητα." : "Χρειαζόμαστε επίσκεψή σας στο κτήριο. Παρακαλώ επιβεβαιώστε ποια από τις παρακάτω ημερομηνίες σας βολεύει.");
  const [dates, setDates] = useState<string[]>([""]);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const buildingFaults = faults.filter((f) => f.buildingId === buildingId);

  function submit() {
    setErr(null);
    start(async () => {
      const res = await createSupplierInquiry({ supplierId: supplier.id, buildingId, maintenanceRequestId: faultId || null, kind, message, preferredDates: dates.filter(Boolean).map((d) => new Date(d).toISOString()) });
      if (res && "error" in res && res.error) { setErr(res.error); return; }
      onDone();
    });
  }

  return (
    <Modal open onClose={onClose} title={`${kind === "OFFER" ? "Ζήτηση προσφοράς" : "Ραντεβού"} — ${supplier.name}`} width={560}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <p style={{ margin: 0, fontSize: "var(--fs-12-5)", color: "var(--muted-foreground)" }}>
          Θα σταλεί email στο <b>{supplier.email}</b> με τα στοιχεία σας ως αποστολέα απάντησης. Η απάντηση έρχεται στο δικό σας email· καταγράψτε την εδώ για να μείνει στο ιστορικό.
        </p>
        {err && <div style={{ color: "var(--destructive)", fontSize: "var(--fs-13)" }}>{err}</div>}
        <FormField label="Κτήριο" required>
          <FieldSelect value={buildingId} onChange={(v) => { setBuildingId(v); setFaultId(""); }} options={buildings.map((b) => ({ value: b.id, label: b.name }))} />
        </FormField>
        <FormField label="Σχετική βλάβη (προαιρετικά)" hint="Η περιγραφή και οι φωτογραφίες της βλάβης θα μπουν στο email.">
          <FieldSelect value={faultId} onChange={setFaultId} options={[{ value: "", label: "— καμία —" }, ...buildingFaults.map((f) => ({ value: f.id, label: f.title }))]} />
        </FormField>
        <FormField label="Μήνυμα" required><FieldTextarea value={message} onChange={setMessage} rows={4} /></FormField>
        {kind === "APPOINTMENT" && (
          <FormField label="Προτεινόμενες ημερομηνίες" required hint="Έως 5. Ο προμηθευτής επιλέγει μία.">
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {dates.map((d, i) => (
                <div key={i} style={{ display: "flex", gap: 6 }}>
                  <div style={{ flex: 1 }}><FieldInput type="datetime-local" value={d} onChange={(v) => setDates((p) => p.map((x, j) => (j === i ? v : x)))} /></div>
                  {dates.length > 1 && <button type="button" onClick={() => setDates((p) => p.filter((_, j) => j !== i))} style={iconBtn}><RiCloseLine /></button>}
                </div>
              ))}
              {dates.length < 5 && <button type="button" onClick={() => setDates((p) => [...p, ""])} style={{ ...btn, alignSelf: "flex-start" }}><RiAddLine /> Άλλη ημερομηνία</button>}
            </div>
          </FormField>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
          <button onClick={onClose} style={btn}>Άκυρο</button>
          <button onClick={submit} disabled={pending || !buildingId || !message.trim()} style={btnPrimary}><RiSendPlaneLine /> {pending ? "Αποστολή…" : "Αποστολή email"}</button>
        </div>
      </div>
    </Modal>
  );
}

/** History of inquiries with a "record the answer" affordance. */
export function InquiryList({ inquiries, canEdit }: { inquiries: InquiryDTO[]; canEdit: boolean }) {
  const router = useRouter();
  const [answering, setAnswering] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [pending, start] = useTransition();
  if (inquiries.length === 0) return null;
  function save(id: string, status: "ANSWERED" | "CLOSED") {
    start(async () => { await recordInquiryAnswer(id, answer, status); setAnswering(null); setAnswer(""); router.refresh(); });
  }
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: "var(--fs-13)", fontWeight: 700, margin: "0 0 8px", display: "flex", alignItems: "center", gap: 6 }}><RiMailSendLine /> Αιτήματα προς τους προμηθευτές μου</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {inquiries.map((i) => {
          const s = STATUS[i.status] ?? { label: i.status, color: "#6b7280" };
          return (
            <div key={i.id} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: "var(--fs-13)" }}>
                {i.kind === "OFFER" ? <RiMoneyEuroCircleLine /> : <RiCalendarCheckLine />}
                <b>{KIND[i.kind] ?? i.kind}</b> · {i.supplierName} · {i.buildingName}
                {i.faultId && <Link href={`/portal/maintenance/${i.faultId}`} style={{ color: "var(--color-primary)" }}>{i.faultTitle}</Link>}
                <span style={{ fontSize: "var(--fs-11)", fontWeight: 700, padding: "2px 8px", borderRadius: 999, color: s.color, background: `${s.color}18`, border: `1px solid ${s.color}40` }}>{s.label}</span>
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: "var(--fs-12)", color: "var(--muted-foreground)" }}>{fmt(i.createdAt)} → {i.sentTo}</span>
              </div>
              {i.preferredDates.length > 0 && <div style={{ fontSize: "var(--fs-12)", color: "var(--muted-foreground)", marginTop: 4 }}>Προτάθηκαν: {i.preferredDates.map(fmt).join(" · ")}</div>}
              {i.answer && <div style={{ fontSize: "var(--fs-12-5)", marginTop: 6, padding: "6px 10px", background: "var(--paper)", borderRadius: 6 }}><b>Απάντηση ({fmt(i.answeredAt)}):</b> {i.answer}</div>}
              {canEdit && i.status === "SENT" && (answering === i.id ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8, maxWidth: 520 }}>
                  <FieldTextarea value={answer} onChange={setAnswer} rows={2} placeholder="π.χ. Προσφορά 180 € + ΦΠΑ, μπορεί Τρίτη 10:00" />
                  <div style={{ display: "flex", gap: 6 }}>
                    <button disabled={pending} onClick={() => save(i.id, "ANSWERED")} style={btnPrimary}><RiCheckLine /> Καταγραφή απάντησης</button>
                    <button disabled={pending} onClick={() => save(i.id, "CLOSED")} style={btn}>Κλείσιμο χωρίς απάντηση</button>
                    <button onClick={() => setAnswering(null)} style={btn}>Άκυρο</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => { setAnswering(i.id); setAnswer(""); }} style={{ ...btn, marginTop: 8 }}>Καταγραφή απάντησης</button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const btn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", borderRadius: 4, padding: "7px 13px", fontSize: "var(--fs-13)", fontWeight: 600, cursor: "pointer" };
const btnPrimary: React.CSSProperties = { ...btn, background: "var(--color-primary)", color: "#fff", borderColor: "var(--color-primary)" };
const iconBtn: React.CSSProperties = { ...btn, padding: 6 };
