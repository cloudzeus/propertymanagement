"use client";

import { useEffect, useState } from "react";
import { RiPriceTag3Line } from "react-icons/ri";

interface Plan {
  monthlyAllowanceEur: number;
  rollover: boolean;
  adminMarkupPercent: number;
  active: boolean;
}
interface Row {
  id: string;
  name: string;
  plan: Plan;
}

const DEFAULT_PLAN: Plan = {
  monthlyAllowanceEur: 0,
  rollover: false,
  adminMarkupPercent: 0,
  active: true,
};

export default function MeteredPlansClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const r = await fetch("/api/admin/metered-plans");
      if (!r.ok) {
        setError("Αποτυχία φόρτωσης");
        return;
      }
      const d = await r.json();
      setRows(
        (d.customers || []).map((c: any) => ({
          id: c.id,
          name: c.name,
          plan: c.meteredPlan ?? { ...DEFAULT_PLAN },
        }))
      );
      setError(null);
    } catch {
      setError("Αποτυχία φόρτωσης");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const patch = (id: string, p: Partial<Plan>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, plan: { ...r.plan, ...p } } : r)));

  const save = async (row: Row) => {
    setSavingId(row.id);
    try {
      const res = await fetch("/api/admin/metered-plans", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: row.id, ...row.plan }),
      });
      if (!res.ok) {
        setError("Αποτυχία αποθήκευσης");
        return;
      }
      setError(null);
      await load();
    } catch {
      setError("Αποτυχία αποθήκευσης");
    } finally {
      setSavingId(null);
    }
  };

  const th: React.CSSProperties = { padding: 12, fontWeight: 600, color: "var(--muted-foreground)" };
  const td: React.CSSProperties = { padding: 12, verticalAlign: "middle" };
  const numInput: React.CSSProperties = {
    padding: "4px 8px",
    borderRadius: 6,
    border: "1px solid var(--border)",
    background: "var(--bg-canvas)",
    color: "var(--foreground)",
    fontSize: 13,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <RiPriceTag3Line style={{ fontSize: 24, color: "var(--color-success)" }} />
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--foreground)", margin: 0 }}>
            Πακέτα Χρεώσεων
          </h1>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 4 }}>
            Μηνιαίο allowance AI / API / video ανά πελάτη + το δικό σας markup μεταπώλησης.
          </p>
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: 16,
            borderRadius: "var(--radius)",
            background: "#FEE7E618",
            border: "1px solid var(--color-danger)",
            color: "var(--color-danger)",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          overflowX: "auto",
        }}
      >
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
              <th style={th}>Πελάτης</th>
              <th style={th}>Μηνιαίο €</th>
              <th style={th}>Rollover</th>
              <th style={th}>Markup %</th>
              <th style={th}>Ενεργό</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ padding: 24, textAlign: "center", color: "var(--muted-foreground)" }}>
                  Φόρτωση…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 24, textAlign: "center", color: "var(--muted-foreground)" }}>
                  Δεν υπάρχουν πελάτες.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ ...td, fontWeight: 500, color: "var(--foreground)" }}>{r.name}</td>
                  <td style={td}>
                    <input
                      type="number"
                      step="0.01"
                      value={r.plan.monthlyAllowanceEur}
                      onChange={(e) => patch(r.id, { monthlyAllowanceEur: Number(e.target.value) })}
                      style={{ ...numInput, width: 90 }}
                    />
                  </td>
                  <td style={td}>
                    <input
                      type="checkbox"
                      checked={r.plan.rollover}
                      onChange={(e) => patch(r.id, { rollover: e.target.checked })}
                    />
                  </td>
                  <td style={td}>
                    <input
                      type="number"
                      value={r.plan.adminMarkupPercent}
                      onChange={(e) => patch(r.id, { adminMarkupPercent: Number(e.target.value) })}
                      style={{ ...numInput, width: 80 }}
                    />
                  </td>
                  <td style={td}>
                    <input
                      type="checkbox"
                      checked={r.plan.active}
                      onChange={(e) => patch(r.id, { active: e.target.checked })}
                    />
                  </td>
                  <td style={td}>
                    <button
                      onClick={() => save(r)}
                      disabled={savingId === r.id}
                      style={{
                        padding: "6px 14px",
                        borderRadius: 6,
                        border: "1px solid var(--border)",
                        background: "var(--color-primary, #2563eb)",
                        color: "#fff",
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: savingId === r.id ? "default" : "pointer",
                        opacity: savingId === r.id ? 0.6 : 1,
                      }}
                    >
                      {savingId === r.id ? "…" : "Αποθήκευση"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
