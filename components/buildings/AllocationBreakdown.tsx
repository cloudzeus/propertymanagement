"use client";

import { useEffect, useState, useTransition } from "react";
import { RiLoaderLine, RiCheckLine } from "react-icons/ri";
import { listExpenseAllocations, setAllocationPaid, type AllocLineDTO } from "@/app/actions/koinochrista";
import type { PaymentMethod } from "@/app/actions/building-expenses";

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "CARD", label: "Κάρτα" }, { value: "CASH", label: "Μετρητά" }, { value: "VIVA", label: "Viva" },
  { value: "BANK_TRANSFER", label: "Τράπεζα" }, { value: "CHECK", label: "Επιταγή" }, { value: "OTHER", label: "Άλλο" },
];
const eur = (n: number) => `${n.toFixed(2)} €`;

export function AllocationBreakdown({ expenseId }: { expenseId: string }) {
  const [rows, setRows] = useState<AllocLineDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    let alive = true;
    listExpenseAllocations(expenseId)
      .then((r) => { if (alive) setRows(r); })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : "Σφάλμα"); });
    return () => { alive = false; };
  }, [expenseId]);

  function mark(allocId: string, party: "owner" | "tenant", paid: boolean, method: PaymentMethod | null) {
    // optimistic
    setRows((prev) => prev?.map((r) => r.id === allocId
      ? (party === "owner"
        ? { ...r, ownerPaid: paid, ownerPaymentMethod: paid ? (method ?? r.ownerPaymentMethod) : null }
        : { ...r, tenantPaid: paid, tenantPaymentMethod: paid ? (method ?? r.tenantPaymentMethod) : null })
      : r) ?? null);
    startTransition(async () => {
      try { await setAllocationPaid(allocId, party, paid, method); }
      catch (e) { setError(e instanceof Error ? e.message : "Σφάλμα"); }
    });
  }

  if (error) return <div style={{ fontSize: 12, color: "var(--color-danger)" }}>{error}</div>;
  if (!rows) return <div style={{ fontSize: 12, color: "var(--muted-foreground)", display: "flex", alignItems: "center", gap: 6 }}><RiLoaderLine style={{ animation: "spin 1s linear infinite" }} /> Φόρτωση ανάλυσης…</div>;
  if (!rows.length) return <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Δεν υπάρχει κατανομή (ελλιπή χιλιοστά μονάδων).</div>;

  return (
    <div style={{ gridColumn: "1 / -1" }}>
      <div style={{ fontSize: 12, fontWeight: 700, margin: "4px 0 6px" }}>Ανάλυση ανά μονάδα</div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--muted-foreground)", borderBottom: "1px solid var(--border-subtle)" }}>
              <th style={c}>Μονάδα</th>
              <th style={c}>Ιδιοκτήτης</th>
              <th style={{ ...c, textAlign: "right" }}>Ποσό</th>
              <th style={c}>Πληρωμή</th>
              <th style={c}>Ενοικιαστής</th>
              <th style={{ ...c, textAlign: "right" }}>Ποσό</th>
              <th style={c}>Πληρωμή</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                <td style={c}><b>{r.unitNumber}</b></td>
                <td style={c}>{r.ownerName ?? "—"}</td>
                <td style={{ ...c, textAlign: "right" }}>{eur(r.ownerAmount)}</td>
                <td style={c}><PayCell paid={r.ownerPaid} method={r.ownerPaymentMethod} disabled={!r.ownerUserId || r.ownerAmount <= 0} onToggle={(p, m) => mark(r.id, "owner", p, m)} /></td>
                <td style={c}>{r.tenantName ?? "—"}</td>
                <td style={{ ...c, textAlign: "right" }}>{eur(r.tenantAmount)}</td>
                <td style={c}><PayCell paid={r.tenantPaid} method={r.tenantPaymentMethod} disabled={!r.tenantUserId || r.tenantAmount <= 0} onToggle={(p, m) => mark(r.id, "tenant", p, m)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function PayCell({ paid, method, disabled, onToggle }: { paid: boolean; method: string | null; disabled: boolean; onToggle: (paid: boolean, method: PaymentMethod | null) => void }) {
  if (disabled) return <span style={{ color: "var(--muted-foreground)" }}>—</span>;
  if (paid) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 2, color: "#16a34a", fontWeight: 600 }}><RiCheckLine /> {method ? (METHODS.find((m) => m.value === method)?.label ?? "Ναι") : "Ναι"}</span>
        <button onClick={() => onToggle(false, null)} style={undoBtn} title="Αναίρεση">↺</button>
      </span>
    );
  }
  return (
    <select
      defaultValue=""
      onChange={(e) => { const v = e.target.value as PaymentMethod | ""; if (v) onToggle(true, v); }}
      style={{ height: 26, fontSize: 11, padding: "0 4px", borderRadius: 5, border: "1px solid var(--border-strong)", background: "var(--bg-canvas)" }}
    >
      <option value="">Μαρκάρισμα…</option>
      {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
    </select>
  );
}

const c: React.CSSProperties = { padding: "5px 8px", verticalAlign: "middle" };
const undoBtn: React.CSSProperties = { border: "none", background: "transparent", cursor: "pointer", color: "var(--muted-foreground)", fontSize: 13 };
