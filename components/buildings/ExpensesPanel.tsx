"use client";

import { useState, useTransition, Fragment } from "react";
import { useRouter } from "next/navigation";
import {
  RiMoneyEuroCircleLine, RiFileTextLine, RiDeleteBinLine, RiMore2Fill, RiEdit2Line,
  RiArrowRightSLine, RiArrowDownSLine, RiSecurePaymentLine, RiCheckLine,
} from "react-icons/ri";
import { ExpenseOcrUpload } from "./ExpenseOcrUpload";
import { ExpenseEditModal } from "./ExpenseEditModal";
import { AllocationBreakdown } from "./AllocationBreakdown";
import { type CategorySplit } from "./ExpenseReviewForm";
import { deleteBuildingExpense, includeExpensesInIssuance, type ExpenseRowDTO } from "@/app/actions/building-expenses";
import type { BuildingCaps } from "@/lib/building-caps";

export type ExpenseRow = ExpenseRowDTO;

const STATUS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "Πρόχειρο", color: "var(--muted-foreground)" },
  CONFIRMED: { label: "Καταχωρημένο", color: "var(--color-primary)" },
  ISSUED: { label: "Σε έκδοση", color: "#16a34a" },
};
const PM_LABEL: Record<string, string> = {
  CARD: "Κάρτα", CASH: "Μετρητά", VIVA: "Viva", BANK_TRANSFER: "Τραπεζική μεταφορά", CHECK: "Επιταγή", OTHER: "Άλλο",
};

const fmtDate = (s: string | null) => { if (!s) return "—"; try { return new Date(s).toLocaleDateString("el-GR"); } catch { return "—"; } };
const eur = (n: number | null) => (n == null ? "—" : `${Number(n).toFixed(2)} €`);

export function ExpensesPanel({
  buildingId, expenses, categories, can,
}: {
  buildingId: string; expenses: ExpenseRow[]; categories: CategorySplit[]; can: BuildingCaps;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [menuId, setMenuId] = useState<string | null>(null);
  const [editing, setEditing] = useState<ExpenseRow | null>(null);

  const selectable = expenses.filter((e) => e.status !== "ISSUED");
  const allSelected = selectable.length > 0 && selectable.every((e) => selected.has(e.id));

  function toggle(id: string) {
    setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(selectable.map((e) => e.id)));
  }
  function toggleExpand(id: string) {
    setExpanded((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  function remove(id: string) {
    if (!confirm("Διαγραφή εξόδου;")) return;
    setMenuId(null);
    startTransition(async () => { try { await deleteBuildingExpense(id); router.refresh(); } catch (e) { alert(e instanceof Error ? e.message : "Σφάλμα"); } });
  }

  function includeInIssuance() {
    const ids = [...selected];
    if (!ids.length) return;
    const month = prompt("Μήνας έκδοσης κοινοχρήστων (YYYY-MM):", new Date().toISOString().slice(0, 7));
    if (!month) return;
    startTransition(async () => {
      try {
        const res = await includeExpensesInIssuance(buildingId, ids, month);
        setSelected(new Set());
        router.refresh();
        alert(`${res.count} έξοδα συμπεριλήφθηκαν στην έκδοση ${month}.`);
      } catch (e) { alert(e instanceof Error ? e.message : "Σφάλμα"); }
    });
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, color: "var(--muted-foreground)", display: "flex", alignItems: "center", gap: 6 }}>
          <RiMoneyEuroCircleLine /> Έξοδα · {expenses.length}
        </div>
        {can.manageExpenses && (
          <div style={{ display: "flex", gap: 8 }}>
            {selected.size > 0 && (
              <button onClick={includeInIssuance} disabled={isPending} style={btnIssue}>
                <RiSecurePaymentLine /> Συμπερίληψη σε έκδοση ({selected.size})
              </button>
            )}
            <ExpenseOcrUpload buildingId={buildingId} categories={categories} />
          </div>
        )}
      </div>

      {expenses.length === 0 ? (
        <div style={{ padding: 28, textAlign: "center", color: "var(--muted-foreground)", fontSize: 13, border: "1px dashed var(--border-strong)", borderRadius: 8 }}>
          Δεν υπάρχουν καταχωρημένα έξοδα.
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--muted-foreground)", borderBottom: "1px solid var(--border-strong)" }}>
                <th style={th}>{can.manageExpenses && <input type="checkbox" checked={allSelected} onChange={toggleAll} title="Επιλογή όλων" />}</th>
                <th style={th}></th>
                <th style={th}>Ημ/νία</th>
                <th style={th}>Προμηθευτής</th>
                <th style={th}>Κατηγορία</th>
                <th style={{ ...th, textAlign: "right" }}>Σύνολο</th>
                <th style={th}>Πληρωμή</th>
                <th style={th}>Κατάσταση</th>
                <th style={{ ...th, textAlign: "right" }}>Ενέργειες</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => {
                const st = STATUS[e.status] ?? { label: e.status, color: "var(--muted-foreground)" };
                const isOpen = expanded.has(e.id);
                return (
                  <Fragment key={e.id}>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={td}>{can.manageExpenses && <input type="checkbox" checked={selected.has(e.id)} disabled={e.status === "ISSUED"} onChange={() => toggle(e.id)} />}</td>
                      <td style={td}><button onClick={() => toggleExpand(e.id)} style={iconBtn} title="Λεπτομέρειες">{isOpen ? <RiArrowDownSLine /> : <RiArrowRightSLine />}</button></td>
                      <td style={td}>{fmtDate(e.documentDate)}</td>
                      <td style={td}>{e.supplierName ?? "—"}</td>
                      <td style={td}>{e.categoryName ?? "—"}</td>
                      <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{eur(e.amount)}</td>
                      <td style={td}>
                        {e.paid
                          ? <span style={{ ...badge, color: "#16a34a", borderColor: "#16a34a" }}><RiCheckLine /> {e.paymentMethod ? PM_LABEL[e.paymentMethod] ?? "Ναι" : "Πληρωμένο"}</span>
                          : <span style={{ ...badge, color: "var(--muted-foreground)", borderColor: "var(--border-strong)" }}>Απλήρωτο</span>}
                      </td>
                      <td style={td}><span style={{ ...badge, color: st.color, borderColor: st.color }}>{st.label}{e.status === "ISSUED" && e.issuedMonth ? ` ${e.issuedMonth}` : ""}</span></td>
                      <td style={{ ...td, textAlign: "right", position: "relative" }}>
                        <button onClick={() => setMenuId(menuId === e.id ? null : e.id)} style={iconBtn} title="Ενέργειες"><RiMore2Fill /></button>
                        {menuId === e.id && (
                          <>
                            <div onClick={() => setMenuId(null)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
                            <div style={menu}>
                              {can.manageExpenses && <button style={menuItem} disabled={e.status === "ISSUED"} onClick={() => { setEditing(e); setMenuId(null); }}><RiEdit2Line /> Επεξεργασία</button>}
                              {e.receiptUrl && <a style={menuItem} href={e.receiptUrl} target="_blank" rel="noreferrer" onClick={() => setMenuId(null)}><RiFileTextLine /> Παραστατικό</a>}
                              {e.paymentUrl && <a style={menuItem} href={e.paymentUrl} target="_blank" rel="noreferrer" onClick={() => setMenuId(null)}><RiSecurePaymentLine /> Απόδειξη πληρωμής</a>}
                              {can.manageExpenses && <button style={{ ...menuItem, color: "var(--color-danger)" }} disabled={e.status === "ISSUED"} onClick={() => remove(e.id)}><RiDeleteBinLine /> Διαγραφή</button>}
                            </div>
                          </>
                        )}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={9} style={{ padding: 0 }}>
                          <div style={detailContainer}>
                            <div style={sectionCard}>
                              <div style={sectionTitle}>Στοιχεία παραστατικού</div>
                              <div style={detailGrid}>
                                <Detail label="Αρ. παραστατικού" value={e.documentNumber ?? "—"} />
                                <Detail label="ΑΦΜ προμηθευτή" value={e.supplierVat ?? "—"} />
                                <Detail label="Μήνας" value={e.month} />
                                <Detail label="Καθαρή αξία" value={eur(e.netAmount)} />
                                <Detail label="ΦΠΑ" value={eur(e.vatAmount)} />
                                <Detail label="Σύνολο" value={eur(e.amount)} strong />
                                <Detail label="Επιμερισμός" value={`Ενοικ. ${e.tenantPct}% · Ιδιοκτ. ${e.ownerPct}%`} />
                                <Detail label="Αξιοπιστία OCR" value={e.ocrConfidence != null ? `${Math.round(e.ocrConfidence * 100)}%` : "—"} />
                                {e.paid && <Detail label="Πληρωμή" value={`${e.paymentMethod ? PM_LABEL[e.paymentMethod] ?? e.paymentMethod : "Ναι"}${e.paidAt ? " · " + fmtDate(e.paidAt) : ""}`} />}
                                {e.status === "ISSUED" && <Detail label="Έκδοση κοινοχρήστων" value={e.issuedMonth ?? "—"} />}
                                {e.meter && (
                                  <Detail label="Ένδειξη μετρητή" value={`${e.meter.meterType}${e.meter.meterNumber ? " #" + e.meter.meterNumber : ""} · ${e.meter.previousReading ?? "—"} → ${e.meter.currentReading ?? "—"}${e.meter.consumption != null ? " (" + e.meter.consumption + " " + (e.meter.unit ?? "") + ")" : ""}`} />
                                )}
                                {e.description && <Detail label="Περιγραφή" value={e.description} />}
                              </div>
                              {(e.receiptUrl || e.paymentUrl) && (
                                <div style={{ display: "flex", gap: 14, marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                                  {e.receiptUrl && <a href={e.receiptUrl} target="_blank" rel="noreferrer" style={linkBtn}><RiFileTextLine /> Παραστατικό</a>}
                                  {e.paymentUrl && <a href={e.paymentUrl} target="_blank" rel="noreferrer" style={linkBtn}><RiSecurePaymentLine /> Απόδειξη πληρωμής</a>}
                                </div>
                              )}
                            </div>
                            {e.allocationsCount > 0 && <div style={sectionCard}><AllocationBreakdown expenseId={e.id} /></div>}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing && <ExpenseEditModal open={!!editing} onClose={() => setEditing(null)} expense={editing} categories={categories} />}
    </div>
  );
}

function Detail({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, color: "var(--muted-foreground)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".02em", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: strong ? 700 : 500, fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}

const th: React.CSSProperties = { padding: "8px 10px", fontWeight: 600, fontSize: 12 };
const td: React.CSSProperties = { padding: "8px 10px", verticalAlign: "middle" };
const badge: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 3, padding: "1px 8px", borderRadius: 999, border: "1px solid", fontSize: 11, fontWeight: 600 };
const iconBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 6, border: "none", background: "transparent", cursor: "pointer", color: "var(--foreground)", fontSize: 16 };
const menu: React.CSSProperties = { position: "absolute", right: 8, top: 36, zIndex: 41, minWidth: 190, background: "var(--card)", border: "1px solid var(--border-strong)", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.14)", padding: 4, display: "flex", flexDirection: "column" };
const menuItem: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 6, border: "none", background: "transparent", cursor: "pointer", fontSize: 13, color: "var(--foreground)", textAlign: "left", width: "100%", textDecoration: "none" };
const detailContainer: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 12, padding: 16, background: "var(--bg-canvas)", borderBottom: "1px solid var(--border)" };
const sectionCard: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: 14 };
const sectionTitle: React.CSSProperties = { fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".03em", color: "var(--muted-foreground)", marginBottom: 12 };
const detailGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: "14px 18px" };
const btnIssue: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, height: 36, padding: "0 14px", borderRadius: 6, border: "1px solid #16a34a", background: "#16a34a", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const linkBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--color-primary)", textDecoration: "none" };
