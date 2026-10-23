"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DataTable, type ColDef, type RowAction } from "@/components/ui/data-table";
import { Modal, FormField, FieldInput, FieldSelect, FieldTextarea } from "@/components/ui/modal";
import { RfqSupplierPicker } from "@/components/suppliers/RfqSupplierPicker";
import { sentMessage, type RfqPickerData } from "@/components/maintenance/rfq-panel";
import { createRfq, resendRfqInvitation, loadRfqCandidatesAction } from "@/app/actions/rfq";
import { useWorkActions } from "@/components/work/useWorkActions";
import { subjectFromRfqInvitationRow } from "@/lib/work/subjects";
import type { WorkActionViewer } from "@/lib/work/scope";
import { INVITATION_STATE_LABELS, INVITATION_STATE_COLORS, RFQ_STATUS_LABELS, OFFER_STATUS_LABELS, eur, type RfqInvitationRowDTO, type InvitationState } from "@/lib/rfq-shared";
import { RiMoneyEuroCircleLine, RiMailSendLine, RiSendPlaneLine, RiLoaderLine } from "react-icons/ri";

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("el-GR", { dateStyle: "short", timeStyle: "short" }) : "—");
const OPEN_RFQ = ["OPEN", "OFFERED"];
const RESENDABLE: InvitationState[] = ["NOT_SENT", "SENT", "OPENED", "NO_EMAIL"];

type Fault = { id: string; title: string; building: string; createdAt: string };

export function RfqInvitationsClient({ rows, faults, canCreate, canEdit, viewer }: { rows: RfqInvitationRowDTO[]; faults: Fault[]; canCreate: boolean; canEdit: boolean; viewer: WorkActionViewer }) {
  const router = useRouter();
  const wa = useWorkActions({ viewer, where: "list" });
  const faultLinks = viewer.canViewFault;
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);

  const counts = useMemo(() => {
    const c: Record<InvitationState, number> = { NO_EMAIL: 0, NOT_SENT: 0, SENT: 0, OPENED: 0, OFFERED: 0, DECLINED: 0, EXPIRED: 0 };
    for (const r of rows) c[r.state]++;
    return c;
  }, [rows]);

  async function run(fn: () => Promise<{ error?: string } | { ok?: boolean; sent?: number }>) {
    setBusy(true); setError(null); setInfo(null);
    const res = await fn();
    setBusy(false);
    if ("error" in res && res.error) { setError(res.error); return false; }
    if ("sent" in res && typeof res.sent === "number") setInfo(sentMessage({ sent: res.sent, failed: (res as { failed?: string[] }).failed }, []));
    router.refresh();
    return true;
  }

  const columns: ColDef<RfqInvitationRowDTO>[] = [
    { id: "supplier", header: "Συνεργάτης", width: 200, sortKey: "supplier", accessor: (r) => r.supplierName, cell: (r) => <b>{r.supplierName}</b> },
    { id: "state", header: "Κατάσταση", width: 170, sortKey: "state", accessor: (r) => INVITATION_STATE_LABELS[r.state], cell: (r) => <StateChip state={r.state} /> },
    {
      id: "rfq", header: "Βλάβη / αίτημα", width: 280, accessor: (r) => `${r.rfqTitle} ${r.buildingName}`,
      cell: (r) => (
        <>
          {faultLinks && r.maintenanceRequestId ? <Link href={`/admin/maintenance/${r.maintenanceRequestId}`} style={{ color: "var(--foreground)", fontWeight: 600, textDecoration: "none" }}>{r.rfqTitle}</Link> : <span style={{ fontWeight: 600 }}>{r.rfqTitle}</span>}
          <div style={{ fontSize: "var(--fs-11-5)", color: "var(--muted-foreground)" }}>{r.buildingName} · {RFQ_STATUS_LABELS[r.rfqStatus] ?? r.rfqStatus}{r.surveyRequired ? " · με αυτοψία" : ""}</div>
        </>
      ),
    },
    { id: "sent", header: "Στάλθηκε", width: 150, sortKey: "sent", accessor: (r) => r.lastEmailAt ?? r.sentAt, cell: (r) => <>{fmt(r.lastEmailAt ?? r.sentAt)}{r.emailCount > 1 && <span style={{ fontSize: "var(--fs-11)", color: "var(--muted-foreground)" }}> ({r.emailCount}×)</span>}</> },
    { id: "viewed", header: "Ανοίχτηκε", width: 140, sortKey: "viewed", accessor: (r) => r.viewedAt ?? "", cell: (r) => fmt(r.viewedAt) },
    { id: "deadline", header: "Προθεσμία", width: 140, sortKey: "deadline", accessor: (r) => r.deadlineAt ?? "", cell: (r) => fmt(r.deadlineAt) },
    { id: "offer", header: "Προσφορά", width: 150, accessor: (r) => r.offer?.amount ?? 0, cell: (r) => (r.offer ? <span style={{ fontVariantNumeric: "tabular-nums" }}>{eur(r.offer.amount)} <span style={{ fontSize: "var(--fs-11)", color: "var(--muted-foreground)" }}>{OFFER_STATUS_LABELS[r.offer.status] ?? r.offer.status}</span></span> : r.declineReason ? <span style={{ fontSize: "var(--fs-11-5)", color: "var(--muted-foreground)" }}>{r.declineReason}</span> : "—") },
  ];

  // «Αποστολή ξανά» belongs to the invitation (this row); everything else is the RFQ's shared action menu.
  const actions = (r: RfqInvitationRowDTO): RowAction<RfqInvitationRowDTO>[] => {
    const out: RowAction<RfqInvitationRowDTO>[] = [];
    if (canEdit && OPEN_RFQ.includes(r.rfqStatus) && RESENDABLE.includes(r.state)) out.push({ label: "Αποστολή ξανά", icon: <RiMailSendLine />, section: "offers", onClick: () => void run(() => resendRfqInvitation(r.id)) });
    return [...out, ...wa.rowActions(subjectFromRfqInvitationRow(r))];
  };

  return (
    <div className="dash-page" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <h1 style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "var(--fs-22)", fontWeight: 700, color: "var(--foreground)", margin: 0 }}><RiMoneyEuroCircleLine style={{ color: "var(--color-primary)" }} /> Αιτήματα προσφοράς</h1>
        <p style={{ margin: "4px 0 0", fontSize: "var(--fs-13)", color: "var(--muted-foreground)" }}>Κάθε γραμμή είναι μία πρόσκληση σε συνεργάτη. Το email περιέχει προσωπικό link 14 ημερών· εδώ βλέπετε αν στάλθηκε, αν ανοίχτηκε και τι απάντησε.</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        {(["SENT", "OPENED", "OFFERED", "DECLINED", "EXPIRED", "NO_EMAIL", "NOT_SENT"] as InvitationState[]).filter((s) => s !== "NOT_SENT" || counts.NOT_SENT > 0).map((s) => (
          <div key={s} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "12px 16px" }}>
            <div style={{ fontSize: "var(--fs-12)", color: "var(--muted-foreground)" }}>{INVITATION_STATE_LABELS[s]}</div>
            <div style={{ fontSize: "var(--fs-24)", fontWeight: 700, color: INVITATION_STATE_COLORS[s] }}>{counts[s]}</div>
          </div>
        ))}
      </div>
      {error && <div role="alert" style={{ color: "var(--destructive)", fontSize: "var(--fs-13)" }}>{error}</div>}
      {info && <div style={{ color: "var(--color-success)", fontSize: "var(--fs-13)" }}>{info}</div>}
      <DataTable
        data={rows} columns={columns} totalRows={rows.length} page={1} pageSize={25} clientSide storageKey="staff-rfq" searchPlaceholder="Αναζήτηση συνεργάτη ή βλάβης…"
        getRowActions={actions}
        onAddNew={canCreate ? () => setCreating(true) : undefined} addNewLabel="Νέο αίτημα προσφοράς"
        expandedContent={(r) => <Recipients r={r} />}
      />
      {creating && <NewRfqModal faults={faults} onClose={() => setCreating(false)} onDone={(msg) => { setCreating(false); setInfo(msg); router.refresh(); }} />}
      {wa.host}
      {busy && <div style={{ fontSize: "var(--fs-12-5)", color: "var(--muted-foreground)" }}><RiLoaderLine style={{ animation: "spin 1s linear infinite", verticalAlign: "-2px" }} /> Αποστολή…</div>}
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function StateChip({ state }: { state: InvitationState }) {
  const c = INVITATION_STATE_COLORS[state];
  return <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: "var(--fs-11-5)", fontWeight: 600, color: c, background: `color-mix(in srgb, ${c} 9%, transparent)`, border: `1px solid color-mix(in srgb, ${c} 25%, transparent)`, whiteSpace: "nowrap" }}>{INVITATION_STATE_LABELS[state]}</span>;
}

function Recipients({ r }: { r: RfqInvitationRowDTO }) {
  if (r.recipients.length === 0) return <div style={{ padding: "8px 12px", fontSize: "var(--fs-12-5)", color: "var(--muted-foreground)" }}>{r.hasRecipient ? "Δεν έχει σταλεί email ακόμη." : "Ο συνεργάτης δεν έχει καμία διεύθυνση email — προσθέστε επαφή με email στην καρτέλα του."}</div>;
  return (
    <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--fs-12-5)" }}>
      <div style={{ fontSize: "var(--fs-11)", fontWeight: 600, color: "var(--muted-foreground)" }}>Παραλήπτες</div>
      {r.recipients.map((x) => (
        <div key={x.email} style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 600 }}>{x.email}</span>
          <span style={{ color: "var(--muted-foreground)" }}>στάλθηκε {fmt(x.sentAt)}</span>
          <span style={{ color: x.openedAt ? "var(--color-info)" : "var(--muted-foreground)" }}>{x.openedAt ? `άνοιξε ${fmt(x.openedAt)}` : "δεν το άνοιξε"}</span>
          {x.expired && <span style={{ color: "var(--color-danger)" }}>το link έληξε</span>}
        </div>
      ))}
    </div>
  );
}

/** Pick an open fault → load ranked candidates → pick suppliers → deadline/survey/notes → send. */
function NewRfqModal({ faults, onClose, onDone }: { faults: Fault[]; onClose: () => void; onDone: (msg: string) => void }) {
  const [faultId, setFaultId] = useState("");
  const [picker, setPicker] = useState<RfqPickerData | null>(null);
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [deadline, setDeadline] = useState("");
  const [survey, setSurvey] = useState(false);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function pickFault(id: string) {
    setFaultId(id); setPicker(null); setSel(new Set()); setError(null);
    if (!id) return;
    setLoading(true);
    const res = await loadRfqCandidatesAction(id);
    setLoading(false);
    if ("error" in res) { setError(res.error); return; }
    setPicker(res);
  }
  async function send() {
    if (!faultId || sel.size === 0) return;
    setBusy(true); setError(null);
    const res = await createRfq({ maintenanceRequestId: faultId, supplierIds: [...sel], deadlineAt: deadline ? new Date(deadline).toISOString() : null, surveyRequired: survey, notes });
    setBusy(false);
    if ("error" in res && res.error) { setError(res.error); return; }
    onDone(sentMessage(res as { sent: number; noEmail?: string[]; failed?: string[] }, picker?.candidates ?? []));
  }
  return (
    <Modal open onClose={onClose} width={760} title="Νέο αίτημα προσφοράς"
      footer={<>
        <button onClick={onClose} style={cancelBtn}>Ακύρωση</button>
        <button onClick={send} disabled={busy || !faultId || sel.size === 0} style={saveBtn}>{busy ? <RiLoaderLine style={{ animation: "spin 1s linear infinite" }} /> : <RiSendPlaneLine />} Αποστολή σε {sel.size} συνεργάτ{sel.size === 1 ? "η" : "ες"}</button>
      </>}>
      {error && <div role="alert" style={errBox}>{error}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <FormField label="Βλάβη" required hint={faults.length === 0 ? "Δεν υπάρχουν ανοιχτές βλάβες χωρίς ενεργή σύμβαση έργου." : undefined}>
          <FieldSelect value={faultId} onChange={pickFault} options={[{ value: "", label: "— επιλέξτε βλάβη —" }, ...faults.map((f) => ({ value: f.id, label: `${f.title} · ${f.building}` }))]} />
        </FormField>
        {loading && <div style={{ fontSize: "var(--fs-12-5)", color: "var(--muted-foreground)" }}><RiLoaderLine style={{ animation: "spin 1s linear infinite", verticalAlign: "-2px" }} /> Φόρτωση συνεργατών…</div>}
        {picker && (
          <>
            <FormField label="Συνεργάτες" required hint="Ταξινομημένοι κατά καταλληλότητα· κάθε παραλήπτης λαμβάνει email με προσωπικό link 14 ημερών.">
              <RfqSupplierPicker candidates={picker.candidates} categories={picker.categories} defaultCategoryId={picker.defaultCategoryId} selected={sel} onChange={setSel} />
            </FormField>
            <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 10, alignItems: "end" }}>
              <FormField label="Προθεσμία απάντησης"><FieldInput type="datetime-local" value={deadline} onChange={setDeadline} /></FormField>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "var(--fs-13)", cursor: "pointer", paddingBottom: 8 }}>
                <input type="checkbox" checked={survey} onChange={(e) => setSurvey(e.target.checked)} /> Ζητείται αυτοψία πριν την προσφορά
              </label>
            </div>
            <FormField label="Σημείωση προς τους συνεργάτες (προαιρετικά)"><FieldTextarea value={notes} onChange={setNotes} rows={2} /></FormField>
          </>
        )}
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </Modal>
  );
}

const cancelBtn: React.CSSProperties = { padding: "7px 16px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--card)", cursor: "pointer", fontSize: "var(--fs-13)", color: "var(--foreground)" };
const saveBtn: React.CSSProperties = { padding: "7px 16px", borderRadius: 6, border: "none", background: "var(--color-primary)", color: "#fff", cursor: "pointer", fontSize: "var(--fs-13)", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 };
const errBox: React.CSSProperties = { marginBottom: 10, padding: "8px 12px", borderRadius: 6, background: "var(--danger-soft)", color: "var(--color-danger)", fontSize: "var(--fs-12)", border: "1px solid var(--danger-soft)" };
