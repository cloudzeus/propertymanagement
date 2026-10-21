"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { resendRfqInvitation } from "@/app/actions/rfq";
import {
  RFQ_STATUS_LABELS, INVITATION_STATE_LABELS, INVITATION_STATE_COLORS, OFFER_STATUS_LABELS, WO_STATUS_LABELS, WO_STATUS_COLORS, eur, withVat, sentMessage,
  type RfqDTO, type OfferDTO, type WorkOrderDTO, type RfqCandidateDTO,
} from "@/lib/rfq-shared";
import { formatDistance } from "@/lib/distance/zones";
import { callAction } from "@/lib/work/client-actions";
import { isLiveWorkOrder, type WorkDialog, type WorkSubject } from "@/lib/work/actions";
import { subjectFromWorkOrderDTO } from "@/lib/work/subjects";
import { RiMoneyEuroCircleLine, RiSendPlaneLine, RiFileTextLine, RiCalendarCheckLine, RiCloseLine, RiStarFill, RiMailSendLine, RiUserAddLine, RiCheckDoubleLine, RiShieldCheckLine, RiEyeLine } from "react-icons/ri";

export { sentMessage };

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("el-GR", { dateStyle: "short", timeStyle: "short" }) : "—");
const fmtD = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("el-GR") : "—");

/** Kept for the /staff/rfq board (NewRfqModal) which still loads candidates itself. */
export type RfqPickerData = { candidates: RfqCandidateDTO[]; categories: { id: string; name: string }[]; defaultCategoryId: string | null };

/**
 * Company-side offers panel on a fault: work orders, RFQs with invitations and
 * offers. Read-only lists — every write goes through the shared work-action
 * dialogs (`onOpen`), the same ones the list menus use. Only «Αποστολή ξανά»
 * stays inline because it belongs to a single invitation.
 */
export function RfqPanel({ rfqs, workOrders, canCreate = true, canEdit = true, canForward = true, canOnBehalf = true, canSchedule = true, onOpen }: {
  rfqs: RfqDTO[]; workOrders: WorkOrderDTO[];
  canCreate?: boolean; canEdit?: boolean; canForward?: boolean; canOnBehalf?: boolean; canSchedule?: boolean;
  /** Opens a shared dialog; work-order rows pass their own subject so the dialog acts on THAT contract. */
  onOpen: (dialog: WorkDialog, subject?: WorkSubject) => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function resend(invitationId: string) {
    setBusy(true); setError(null); setInfo(null);
    const res = await callAction(() => resendRfqInvitation(invitationId));
    setBusy(false);
    if ("error" in res && res.error) { setError(res.error); return; }
    if ("sent" in res) setInfo(sentMessage(res as { sent: number; noEmail?: string[]; failed?: string[] }, []));
    router.refresh();
  }
  const active = rfqs.filter((r) => !["CANCELLED", "EXPIRED", "DECLINED"].includes(r.status));
  const liveWo = workOrders.find((w) => isLiveWorkOrder(w.status)) ?? null;
  const canSendNew = canCreate && active.length === 0 && !liveWo;

  return (
    <div style={card}>
      <div style={{ ...h3, flexWrap: "wrap" }}>
        <RiMoneyEuroCircleLine /> Προσφορές & σύμβαση έργου
        <span style={{ flex: 1 }} />
        {canSendNew && <button type="button" style={btnPrimary} onClick={() => onOpen("create-rfq")}><RiSendPlaneLine /> Νέο αίτημα προσφοράς</button>}
      </div>
      {error && <div role="alert" style={{ color: "var(--destructive)", fontSize: "var(--fs-13)", marginBottom: 10 }}>{error}</div>}
      {info && <div role="status" style={{ color: "#15803d", fontSize: "var(--fs-13)", marginBottom: 10 }}>{info}</div>}

      {workOrders.map((w) => <WorkOrderRow key={w.id} w={w} canSchedule={canSchedule} canOnBehalf={canOnBehalf} onOpen={(d) => onOpen(d, subjectFromWorkOrderDTO(w))} />)}

      {rfqs.map((r) => {
        const open = ["OPEN", "OFFERED"].includes(r.status);
        return (
          <div key={r.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 14, marginBottom: 12, opacity: ["CANCELLED", "EXPIRED"].includes(r.status) ? 0.6 : 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <b style={{ fontSize: "var(--fs-13-5)" }}>Αίτημα προσφοράς · {fmt(r.createdAt)}</b>
              <span style={pill}>{RFQ_STATUS_LABELS[r.status] ?? r.status}</span>
              {r.deadlineAt && <span style={{ fontSize: "var(--fs-12)", color: "var(--muted-foreground)" }}>προθεσμία {fmt(r.deadlineAt)}</span>}
              {r.surveyRequired && <span style={pill}>με αυτοψία</span>}
              <span style={{ flex: 1 }} />
              {open && canCreate && <button type="button" disabled={busy} style={btn} onClick={() => onOpen("add-rfq-suppliers")}><RiUserAddLine /> Προσθήκη συνεργατών</button>}
              {open && canEdit && <button type="button" disabled={busy} style={btn} onClick={() => onOpen("cancel-rfq")}><RiCloseLine /> Ακύρωση</button>}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {r.invitations.map((i) => {
                const color = INVITATION_STATE_COLORS[i.state];
                const who = i.recipients.length ? i.recipients.map((x) => `${x.email}${x.openedAt ? ` (άνοιξε ${fmt(x.openedAt)})` : ""}`).join(", ") : "Κανένας παραλήπτης email";
                const canResend = canEdit && open && ["NOT_SENT", "SENT", "OPENED", "NO_EMAIL"].includes(i.state);
                return (
                  <span key={i.supplierId} style={{ ...pill, color, borderColor: `${color}55`, background: `${color}10` }} title={i.declineReason ?? `${who}${i.emailCount ? ` · ${i.emailCount}× email, τελευταίο ${fmt(i.lastEmailAt)}` : ""}`}>
                    {i.supplierName} · {INVITATION_STATE_LABELS[i.state]}
                    {canResend && <button type="button" disabled={busy} title="Αποστολή email ξανά" onClick={() => void resend(i.id)} style={{ border: "none", background: "none", color, cursor: "pointer", padding: 0, display: "inline-flex", marginLeft: 2 }}><RiMailSendLine /></button>}
                  </span>
                );
              })}
            </div>
            {r.offers.length > 0 && (
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                {r.offers.map((o) => <OfferRow key={o.id} o={o} canForward={canForward && open && o.status === "SUBMITTED" && !liveWo} onOpen={onOpen} />)}
              </div>
            )}
            {r.notes && <p style={{ fontSize: "var(--fs-12)", color: "var(--muted-foreground)", margin: "8px 0 0" }}>Σημείωση: {r.notes}</p>}
          </div>
        );
      })}

      {workOrders.length === 0 && rfqs.length === 0 && (
        <p style={{ fontSize: "var(--fs-12-5)", color: "var(--muted-foreground)", margin: 0 }}>
          Δεν έχει σταλεί αίτημα προσφοράς.{canSendNew ? " Πατήστε «Νέο αίτημα προσφοράς» ή «Ενέργειες → Αίτημα προσφοράς σε συνεργάτες…»." : ""}
        </p>
      )}
    </div>
  );
}

function WorkOrderRow({ w, canSchedule, canOnBehalf, onOpen }: { w: WorkOrderDTO; canSchedule: boolean; canOnBehalf: boolean; onOpen: (d: WorkDialog) => void }) {
  const color = WO_STATUS_COLORS[w.status] ?? "#6b7280";
  return (
    <div style={{ border: `1px solid ${color}55`, background: `${color}0a`, borderRadius: 10, padding: 14, marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <Link href={`/admin/work-orders/${w.id}`} style={{ fontSize: "var(--fs-14)", fontWeight: 700, color: "var(--foreground)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}><RiEyeLine /> {w.number}</Link>
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
        <Kv k="Περιθώριο" v={w.markupPct != null ? `${w.markupPct}% · ${eur(w.customerPrice - (w.supplierPrice ?? 0) - (w.travelFee ?? 0))}` : "—"} />
        <Kv k="Μετάβαση" v={w.travelFee != null && w.travelFee > 0 ? `${eur(w.travelFee)}${w.travelZone ? ` · Ζώνη ${w.travelZone}` : ""}${w.travelKm != null ? ` · ${w.travelKm} km` : ""}` : "—"} />
        <Kv k="Αποδοχή πελάτη" v={w.customerAcceptedAt ? fmt(w.customerAcceptedAt) : w.customerDeclinedAt ? `Απόρριψη ${fmt(w.customerDeclinedAt)}${w.customerDeclineReason ? ` — ${w.customerDeclineReason}` : ""}` : "εκκρεμεί"} />
        <Kv k="Αποδοχή συνεργάτη" v={w.supplierAcceptedAt ? fmt(w.supplierAcceptedAt) : "εκκρεμεί"} />
        <Kv k="Ραντεβού" v={fmt(w.scheduledAt)} />
        <Kv k="Παραλαβή" v={w.customerConfirmedAt ? `Επιβεβαιώθηκε ${fmt(w.customerConfirmedAt)}` : w.status === "DISPUTED" ? `Αμφισβήτηση: ${w.disputeNote}` : w.completedAt ? `Ολοκληρώθηκε ${fmt(w.completedAt)} — αναμένει πελάτη` : "—"} />
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
        {canOnBehalf && w.status === "PENDING_CUSTOMER" && <button type="button" style={btn} onClick={() => onOpen("wo-respond")}><RiCheckDoubleLine /> Αποδοχή / απόρριψη εκ μέρους πελάτη…</button>}
        {canSchedule && ["ACCEPTED", "SCHEDULED"].includes(w.status) && <button type="button" style={btn} onClick={() => onOpen("wo-schedule")}><RiCalendarCheckLine /> {w.scheduledAt ? "Αλλαγή ραντεβού έργου…" : "Προγραμματισμός έργου…"}</button>}
        {canOnBehalf && w.status === "COMPLETED" && <button type="button" style={btn} onClick={() => onOpen("wo-confirm")}><RiShieldCheckLine /> Παραλαβή έργου εκ μέρους πελάτη…</button>}
      </div>
      {w.completionMedia.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
          {w.completionMedia.map((m, i) => <a key={i} href={m.url} target="_blank" rel="noreferrer"><img src={m.url} alt="" style={{ width: 84, height: 64, objectFit: "cover", borderRadius: 6, border: "1px solid var(--border)" }} /></a>)}
        </div>
      )}
    </div>
  );
}

function OfferRow({ o, canForward, onOpen }: { o: OfferDTO; canForward: boolean; onOpen: (d: WorkDialog) => void }) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px", background: o.status === "SELECTED" ? "#15803d0a" : "var(--card)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: "var(--fs-13)" }}>
        <b>{o.supplierName}</b>
        {o.supplierRating != null && <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "#b45309", fontSize: "var(--fs-12)" }}><RiStarFill /> {o.supplierRating.toFixed(1)} ({o.supplierRatingCount})</span>}
        <span style={{ fontWeight: 700 }}>{eur(o.amount)} <span style={{ fontWeight: 400, color: "var(--muted-foreground)" }}>+ ΦΠΑ {o.vatPct}%</span></span>
        {o.surveyFee != null && o.surveyFee > 0 && <span style={{ color: "var(--muted-foreground)" }}>αυτοψία {eur(o.surveyFee)}{o.surveyWaived ? " (συμψηφίζεται)" : ""}</span>}
        {o.supplierDistance && <span style={{ color: "var(--muted-foreground)" }}>{formatDistance(o.supplierDistance.km, null, o.supplierDistance.method)} από την έδρα του</span>}
        <span style={{ color: "var(--muted-foreground)" }}>από {fmtD(o.earliestDate)} · ισχύει έως {fmtD(o.validUntil)}{o.estimatedMinutes ? ` · ~${o.estimatedMinutes}′` : ""}</span>
        <span style={pill}>{OFFER_STATUS_LABELS[o.status] ?? o.status}</span>
        <span style={{ flex: 1 }} />
        {canForward && <button type="button" style={btnPrimary} onClick={() => onOpen("forward-offer")}><RiSendPlaneLine /> Προώθηση στον πελάτη…</button>}
      </div>
      {o.description && <p style={{ fontSize: "var(--fs-12-5)", color: "var(--muted-foreground)", margin: "6px 0 0", whiteSpace: "pre-wrap" }}>{o.description}</p>}
    </div>
  );
}

function Kv({ k, v }: { k: string; v: string }) {
  return <div><div style={{ fontSize: "var(--fs-11)", color: "var(--muted-foreground)", fontWeight: 600 }}>{k}</div><div style={{ color: "var(--foreground)" }}>{v}</div></div>;
}

const card: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 18 };
const h3: React.CSSProperties = { fontSize: "var(--fs-13)", fontWeight: 700, color: "var(--foreground)", margin: "0 0 12px", display: "flex", alignItems: "center", gap: 6 };
const pill: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 4, fontSize: "var(--fs-11)", fontWeight: 700, padding: "2px 8px", borderRadius: 999, border: "1px solid var(--border)", background: "var(--paper)", color: "var(--foreground)" };
const btn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, minHeight: 32, padding: "0 12px", border: "1px solid var(--border)", background: "var(--paper)", borderRadius: "var(--radius-sm)", fontSize: "var(--fs-12-5)", fontWeight: 600, cursor: "pointer", color: "var(--foreground)", fontFamily: "inherit" };
const btnPrimary: React.CSSProperties = { ...btn, background: "var(--primary)", color: "var(--primary-foreground)", border: "none" };
const link: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 4, fontSize: "var(--fs-12)", color: "var(--color-primary)", textDecoration: "none" };
