"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FieldTextarea } from "@/components/ui/modal";
import { respondWorkOrder, confirmWorkOrder } from "@/app/actions/rfq";
import { WO_STATUS_LABELS, WO_STATUS_COLORS, eur, withVat, type WorkOrderDTO } from "@/lib/rfq-shared";
import { RiFileTextLine, RiCheckLine, RiCloseLine, RiShieldCheckLine, RiCalendarCheckLine, RiThumbUpLine, RiAlertLine } from "react-icons/ri";

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("el-GR", { dateStyle: "long", timeStyle: "short" }) : "—");
const fmtD = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("el-GR", { dateStyle: "long" }) : "—");

/**
 * Customer-side card for a fault's work order: the company's offer to accept
 * or decline, then progress, and finally the proof of repair to confirm or
 * dispute. Never shows supplier identity or price.
 */
export function OfferCard({ workOrders, canDecide, companyName }: { workOrders: WorkOrderDTO[]; canDecide: boolean; companyName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [showDecline, setShowDecline] = useState<string | null>(null);
  const [showDispute, setShowDispute] = useState<string | null>(null);
  async function run(fn: () => Promise<{ error?: string | null } | { ok?: boolean }>) {
    setBusy(true); setError(null);
    const res = await fn();
    setBusy(false);
    if (res && "error" in res && res.error) { setError(res.error); return; }
    setShowDecline(null); setShowDispute(null); setReason("");
    router.refresh();
  }
  if (workOrders.length === 0) return null;

  return (
    <>
      {workOrders.map((w) => {
        const color = WO_STATUS_COLORS[w.status] ?? "#6b7280";
        const gross = withVat(w.customerPrice, w.vatPct);
        return (
          <div key={w.id} style={{ background: "var(--card)", border: `1px solid ${color}66`, borderRadius: "var(--radius-lg)", padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
              <span style={{ fontSize: "var(--fs-13)", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6 }}><RiShieldCheckLine /> Προσφορά από {companyName} · {w.number}</span>
              <span style={{ fontSize: "var(--fs-11)", fontWeight: 700, padding: "2px 8px", borderRadius: 999, color, background: `${color}18`, border: `1px solid ${color}40` }}>{WO_STATUS_LABELS[w.status] ?? w.status}</span>
              <span style={{ flex: 1 }} />
              <Link href={`/portal/work-orders/${w.id}/contract`} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "var(--fs-12-5)", color: "var(--color-primary)", textDecoration: "none" }}><RiFileTextLine /> Σύμβαση έργου</Link>
            </div>
            {error && <div style={{ color: "var(--destructive)", fontSize: "var(--fs-13)", marginBottom: 8 }}>{error}</div>}

            {w.covered ? (
              <p style={{ margin: 0, fontSize: "var(--fs-14)" }}>Η εργασία <b>καλύπτεται από τη σύμβαση διαχείρισης</b> — δεν προκύπτει χρέωση. Θα ενημερωθείτε για το ραντεβού.</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "start" }}>
                <div style={{ fontSize: "var(--fs-13-5)", color: "var(--foreground)" }}>
                  {w.customerMessage && <p style={{ margin: "0 0 8px", whiteSpace: "pre-wrap" }}>{w.customerMessage}</p>}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 14, fontSize: "var(--fs-12-5)", color: "var(--muted-foreground)" }}>
                    <span><RiCalendarCheckLine style={{ verticalAlign: "-2px" }} /> Νωρίτερη έναρξη: {fmtD(w.earliestDate)}</span>
                    {w.validUntil && <span>Ισχύει έως {fmtD(w.validUntil)}</span>}
                    {w.warrantyMonths != null && <span>Εγγύηση {w.warrantyMonths} μήνες</span>}
                    {w.surveyFee != null && w.surveyFee > 0 && <span>Αυτοψία {eur(w.surveyFee)}{w.surveyWaived ? " (συμψηφίζεται)" : ""}</span>}
                  </div>
                </div>
                <div style={{ textAlign: "right", background: "var(--paper)", borderRadius: 10, padding: "10px 14px", minWidth: 180 }}>
                  <div style={{ fontSize: "var(--fs-11)", color: "var(--muted-foreground)" }}>Καθαρή αξία</div>
                  <div style={{ fontSize: "var(--fs-15)", fontWeight: 600 }}>{eur(w.customerPrice)}</div>
                  <div style={{ fontSize: "var(--fs-11)", color: "var(--muted-foreground)", marginTop: 4 }}>ΦΠΑ {w.vatPct}%</div>
                  <div style={{ fontSize: "var(--fs-22)", fontWeight: 800, color: "var(--foreground)" }}>{eur(gross)}</div>
                </div>
              </div>
            )}

            {/* Decision */}
            {w.status === "PENDING_CUSTOMER" && (canDecide ? (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                {showDecline === w.id ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 520 }}>
                    <FieldTextarea value={reason} onChange={setReason} rows={2} placeholder="Γιατί δεν προχωράτε; (προαιρετικά — βοηθά την εταιρεία να επανέλθει με καλύτερη πρόταση)" />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button disabled={busy} style={btnDanger} onClick={() => run(() => respondWorkOrder(w.id, false, reason))}><RiCloseLine /> Απόρριψη προσφοράς</button>
                      <button disabled={busy} style={btn} onClick={() => setShowDecline(null)}>Άκυρο</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <button disabled={busy} style={btnPrimary} onClick={() => confirm(`Αποδοχή προσφοράς ${eur(gross)} (με ΦΠΑ); Θα συναφθεί σύμβαση έργου.`) && run(() => respondWorkOrder(w.id, true))}><RiCheckLine /> Αποδοχή προσφοράς</button>
                    <button disabled={busy} style={btn} onClick={() => setShowDecline(w.id)}>Δεν προχωρώ</button>
                    <span style={{ fontSize: "var(--fs-12)", color: "var(--muted-foreground)" }}>Με την αποδοχή καταγράφονται χρήστης, ώρα και IP.</span>
                  </div>
                )}
              </div>
            ) : (
              <p style={{ margin: "10px 0 0", fontSize: "var(--fs-12-5)", color: "var(--muted-foreground)" }}>Η προσφορά περιμένει απάντηση από τον διαχειριστή του κτηρίου.</p>
            ))}

            {w.status === "ACCEPTED" && <p style={{ margin: "10px 0 0", fontSize: "var(--fs-13)" }}>Αποδεκτή {fmt(w.customerAcceptedAt)}. Η εταιρεία ορίζει ημερομηνία επισκευής.</p>}
            {w.status === "SCHEDULED" && <p style={{ margin: "10px 0 0", fontSize: "var(--fs-13)" }}><RiCalendarCheckLine style={{ verticalAlign: "-2px" }} /> Ραντεβού: <b>{fmt(w.scheduledAt)}</b></p>}
            {w.status === "IN_PROGRESS" && <p style={{ margin: "10px 0 0", fontSize: "var(--fs-13)" }}>Η εργασία είναι σε εξέλιξη.</p>}
            {w.status === "DECLINED" && <p style={{ margin: "10px 0 0", fontSize: "var(--fs-13)", color: "var(--muted-foreground)" }}>Απορρίφθηκε {fmt(w.customerDeclinedAt)}.</p>}

            {/* Proof of repair → confirmation */}
            {(w.status === "COMPLETED" || w.status === "CONFIRMED" || w.status === "DISPUTED") && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                <div style={{ fontSize: "var(--fs-13)", fontWeight: 700, marginBottom: 6 }}>Απόδειξη επισκευής · {fmt(w.completedAt)}</div>
                {w.completionNote && <p style={{ margin: "0 0 8px", fontSize: "var(--fs-13-5)", whiteSpace: "pre-wrap" }}>{w.completionNote}</p>}
                {w.completionMedia.length > 0 && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                    {w.completionMedia.map((m, i) => m.kind === "VIDEO"
                      ? <video key={i} src={m.url} controls style={{ width: 200, borderRadius: 8, border: "1px solid var(--border)" }} />
                      : <a key={i} href={m.url} target="_blank" rel="noreferrer"><img src={m.url} alt="" style={{ width: 120, height: 90, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)" }} /></a>)}
                  </div>
                )}
                {w.status === "CONFIRMED" && <p style={{ margin: 0, fontSize: "var(--fs-13)", color: "#15803d", fontWeight: 600 }}><RiThumbUpLine style={{ verticalAlign: "-2px" }} /> Παραλάβατε την εργασία {fmt(w.customerConfirmedAt)}.</p>}
                {w.status === "DISPUTED" && <p style={{ margin: 0, fontSize: "var(--fs-13)", color: "#9f1239" }}><RiAlertLine style={{ verticalAlign: "-2px" }} /> Αμφισβητήσατε την παραλαβή: {w.disputeNote}. Ο συνεργάτης θα επανέλθει.</p>}
                {w.status === "COMPLETED" && (canDecide ? (
                  showDispute === w.id ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 520 }}>
                      <FieldTextarea value={reason} onChange={setReason} rows={2} placeholder="Τι δεν έγινε σωστά;" />
                      <div style={{ display: "flex", gap: 8 }}>
                        <button disabled={busy} style={btnDanger} onClick={() => run(() => confirmWorkOrder(w.id, false, reason))}><RiAlertLine /> Αποστολή αμφισβήτησης</button>
                        <button disabled={busy} style={btn} onClick={() => setShowDispute(null)}>Άκυρο</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button disabled={busy} style={btnPrimary} onClick={() => run(() => confirmWorkOrder(w.id, true))}><RiThumbUpLine /> Η εργασία έγινε σωστά</button>
                      <button disabled={busy} style={btn} onClick={() => setShowDispute(w.id)}>Κάτι δεν πάει καλά</button>
                    </div>
                  )
                ) : <p style={{ margin: 0, fontSize: "var(--fs-12-5)", color: "var(--muted-foreground)" }}>Αναμένεται επιβεβαίωση παραλαβής από τον διαχειριστή.</p>)}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

const btn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, height: 38, padding: "0 14px", border: "1px solid var(--border)", background: "var(--paper)", borderRadius: "var(--radius-sm)", fontSize: "var(--fs-13)", fontWeight: 600, cursor: "pointer", color: "var(--foreground)" };
const btnPrimary: React.CSSProperties = { ...btn, background: "var(--primary)", color: "var(--primary-foreground)", border: "none" };
const btnDanger: React.CSSProperties = { ...btn, background: "#9f1239", color: "#fff", border: "none" };
