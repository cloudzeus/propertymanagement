"use client";

import { useEffect, useState, useTransition } from "react";
import { RiLoaderLine, RiCheckLine } from "react-icons/ri";
import { Modal } from "@/components/ui/modal";
import { getPersonStatement, setAllocationsPaid, type PersonStatement } from "@/app/actions/koinochrista";
import type { PaymentMethod } from "@/app/actions/building-expenses";

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "CARD", label: "Κάρτα" }, { value: "CASH", label: "Μετρητά" }, { value: "VIVA", label: "Viva" },
  { value: "BANK_TRANSFER", label: "Τράπεζα" }, { value: "CHECK", label: "Επιταγή" }, { value: "OTHER", label: "Άλλο" },
];
const eur = (n: number) => `${n.toLocaleString("el-GR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const fmtDate = (s: string | null) => { if (!s) return "—"; try { return new Date(s).toLocaleDateString("el-GR"); } catch { return "—"; } };
const PM_LABEL: Record<string, string> = { CARD: "Κάρτα", CASH: "Μετρητά", VIVA: "Viva", BANK_TRANSFER: "Τράπεζα", CHECK: "Επιταγή", OTHER: "Άλλο" };

export function PersonStatementModal({
  open, onClose, buildingId, userId, onChanged,
}: {
  open: boolean; onClose: () => void; buildingId: string; userId: string; onChanged?: () => void;
}) {
  const [data, setData] = useState<PersonStatement | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function load() {
    setData(null);
    getPersonStatement(buildingId, userId).then((d) => { setData(d); setSel(new Set()); }).catch((e) => setError(e instanceof Error ? e.message : "Σφάλμα"));
  }
  useEffect(() => { if (open) load(); /* eslint-disable-next-line */ }, [open, buildingId, userId]);

  const unpaid = data?.lines.filter((l) => !l.paid) ?? [];
  const key = (l: { allocationId: string; party: string }) => `${l.allocationId}:${l.party}`;
  const allUnpaidSelected = unpaid.length > 0 && unpaid.every((l) => sel.has(key(l)));

  function toggle(k: string) { setSel((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; }); }
  function toggleAll() { setSel(allUnpaidSelected ? new Set() : new Set(unpaid.map(key))); }

  function pay() {
    if (!data || !sel.size) return;
    const items = data.lines.filter((l) => sel.has(key(l))).map((l) => ({ allocationId: l.allocationId, party: l.party }));
    startTransition(async () => {
      try { await setAllocationsPaid(buildingId, items, true, method); load(); onChanged?.(); }
      catch (e) { setError(e instanceof Error ? e.message : "Σφάλμα πληρωμής"); }
    });
  }
  function unpay(l: { allocationId: string; party: "owner" | "tenant" }) {
    startTransition(async () => {
      try { await setAllocationsPaid(buildingId, [{ allocationId: l.allocationId, party: l.party }], false, null); load(); onChanged?.(); }
      catch (e) { setError(e instanceof Error ? e.message : "Σφάλμα"); }
    });
  }

  return (
    <Modal open={open} onClose={onClose} title={data ? `Καρτέλα — ${data.name}` : "Καρτέλα προσώπου"} width={860}>
      {error && <div style={{ padding: 10, borderRadius: 6, background: "color-mix(in srgb, var(--color-danger) 12%, transparent)", border: "1px solid var(--color-danger)", color: "var(--color-danger)", fontSize: 12, marginBottom: 10 }}>{error}</div>}
      {!data ? (
        <div style={{ padding: 20, color: "var(--muted-foreground)", display: "flex", alignItems: "center", gap: 6 }}><RiLoaderLine style={{ animation: "spin 1s linear infinite" }} /> Φόρτωση…</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Stat label="Σύνολο" value={eur(data.total)} />
            <Stat label="Πληρωμένα" value={eur(data.paid)} color="#16a34a" />
            <Stat label="Υπόλοιπο" value={eur(data.due)} color={data.due > 0 ? "#b91c1c" : undefined} />
            <div style={{ marginLeft: "auto", fontSize: 12, color: "var(--muted-foreground)", alignSelf: "center" }}>{data.email ?? "— χωρίς email —"} · Μονάδες: {data.units.join(", ") || "—"}</div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--muted-foreground)", borderBottom: "1px solid var(--border-strong)" }}>
                  <th style={th}><input type="checkbox" checked={allUnpaidSelected} onChange={toggleAll} disabled={!unpaid.length} title="Επιλογή ανεξόφλητων" /></th>
                  <th style={th}>Μήνας</th><th style={th}>Κατηγορία</th><th style={th}>Προμηθευτής</th><th style={th}>Μονάδα</th><th style={th}>Ιδιότητα</th>
                  <th style={{ ...th, textAlign: "right" }}>Ποσό</th><th style={th}>Κατάσταση</th>
                </tr>
              </thead>
              <tbody>
                {data.lines.map((l) => {
                  const k = key(l);
                  return (
                    <tr key={k} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={td}>{!l.paid ? <input type="checkbox" checked={sel.has(k)} onChange={() => toggle(k)} /> : null}</td>
                      <td style={{ ...td, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums", color: "var(--muted-foreground)" }}>{l.month}</td>
                      <td style={td}>{l.category ?? "—"}</td>
                      <td style={td}>{l.supplier ?? "—"}<div style={{ fontSize: 10, color: "var(--muted-foreground)" }}>{fmtDate(l.documentDate)}{l.documentNumber ? " · " + l.documentNumber : ""}</div></td>
                      <td style={td}>{l.unitNumber}</td>
                      <td style={td}>{l.party === "owner" ? "Ιδιοκτήτης" : "Ενοικιαστής"}</td>
                      <td style={{ ...td, textAlign: "right", fontWeight: 600, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{eur(l.amount)}</td>
                      <td style={td}>
                        {l.paid
                          ? <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ color: "#16a34a", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 2 }}><RiCheckLine /> {l.paymentMethod ? PM_LABEL[l.paymentMethod] ?? "Ναι" : "Πληρωμένο"}</span><button onClick={() => unpay(l)} disabled={pending} style={undoBtn} title="Αναίρεση">↺</button></span>
                          : <span style={{ color: "var(--muted-foreground)" }}>Ανεξόφλητο</span>}
                      </td>
                    </tr>
                  );
                })}
                {data.lines.length === 0 && <tr><td colSpan={8} style={{ ...td, textAlign: "center", color: "var(--muted-foreground)" }}>Καμία κίνηση.</td></tr>}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
            <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{sel.size} επιλεγμένα</span>
            <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} style={{ height: 34, padding: "0 10px", borderRadius: 6, border: "1px solid var(--border-strong)", background: "var(--bg-canvas)", fontSize: 13 }}>
              {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <button onClick={pay} disabled={!sel.size || pending} style={btnPay}>{pending ? <RiLoaderLine style={{ animation: "spin 1s linear infinite" }} /> : <RiCheckLine />} Καταχώρηση πληρωμής</button>
          </div>
        </div>
      )}
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </Modal>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ border: "1px solid var(--border-strong)", borderRadius: 8, padding: "6px 12px", background: "var(--card)", minWidth: 100 }}>
      <div style={{ fontSize: 10, color: "var(--muted-foreground)", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 800, color: color ?? "var(--foreground)" }}>{value}</div>
    </div>
  );
}

const th: React.CSSProperties = { padding: "7px 9px", fontWeight: 600, fontSize: 11 };
const td: React.CSSProperties = { padding: "7px 9px", verticalAlign: "middle" };
const undoBtn: React.CSSProperties = { border: "none", background: "transparent", cursor: "pointer", color: "var(--muted-foreground)", fontSize: 13 };
const btnPay: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, height: 34, padding: "0 16px", borderRadius: 6, border: "1px solid #16a34a", background: "#16a34a", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" };
