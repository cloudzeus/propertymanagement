"use client";

import { useEffect, useState } from "react";
import { RiWallet3Line } from "react-icons/ri";

interface Row {
  id: string;
  name: string;
  balanceEur: number;
  lowBalanceEur: number | null;
}

export default function CustomerWalletsClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  const load = async () => {
    try {
      setLoading(true);
      const r = await fetch("/api/admin/customer-wallets");
      if (!r.ok) {
        setError("Αποτυχία φόρτωσης");
        return;
      }
      const d = await r.json();
      setRows(d.rows || []);
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

  const adjust = async (row: Row) => {
    const amountEur = Number(amounts[row.id]);
    if (!Number.isFinite(amountEur) || amountEur === 0) {
      setError("Δώστε ένα έγκυρο ποσό (≠ 0)");
      return;
    }
    setSavingId(row.id);
    try {
      const res = await fetch("/api/admin/customer-wallets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: row.id, amountEur }),
      });
      if (!res.ok) {
        setError("Αποτυχία διόρθωσης");
        return;
      }
      setError(null);
      setAmounts((a) => ({ ...a, [row.id]: "" }));
      await load();
    } catch {
      setError("Αποτυχία διόρθωσης");
    } finally {
      setSavingId(null);
    }
  };

  const isLow = (r: Row) =>
    r.balanceEur <= 0 || (r.lowBalanceEur != null && r.balanceEur < r.lowBalanceEur);

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
        <RiWallet3Line style={{ fontSize: 24, color: "var(--color-success)" }} />
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--foreground)", margin: 0 }}>
            Υπόλοιπα Πελατών
          </h1>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 4 }}>
            Προπληρωμένο υπόλοιπο AI / API / video ανά πελάτη — χειροκίνητη πίστωση ή διόρθωση.
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
              <th style={th}>Υπόλοιπο</th>
              <th style={th}>Πίστωση / Διόρθωση (±€)</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} style={{ padding: 24, textAlign: "center", color: "var(--muted-foreground)" }}>
                  Φόρτωση…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: 24, textAlign: "center", color: "var(--muted-foreground)" }}>
                  Δεν υπάρχουν πελάτες.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ ...td, fontWeight: 500, color: "var(--foreground)" }}>{r.name}</td>
                  <td
                    style={{
                      ...td,
                      fontWeight: 600,
                      color: isLow(r) ? "var(--color-danger)" : "var(--foreground)",
                    }}
                  >
                    {r.balanceEur.toFixed(2)} €
                  </td>
                  <td style={td}>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={amounts[r.id] ?? ""}
                      onChange={(e) => setAmounts((a) => ({ ...a, [r.id]: e.target.value }))}
                      style={{ ...numInput, width: 110 }}
                    />
                  </td>
                  <td style={td}>
                    <button
                      onClick={() => adjust(r)}
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
                      {savingId === r.id ? "…" : "Πίστωση/Διόρθωση"}
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
