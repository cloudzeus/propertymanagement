"use client";

import { useEffect, useState } from "react";
import { RiMoneyEuroCircleLine } from "react-icons/ri";

interface BilledItem { apiName: string; displayName: string; billedCost: number; }

export default function AdminCostsPage() {
  const [items, setItems] = useState<BilledItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/admin/costs");
        if (!res.ok) throw new Error("Failed to load costs");
        const data = await res.json();
        setItems(data.breakdown || []);
        setTotal(data.billedTotal || 0);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load costs");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <RiMoneyEuroCircleLine style={{ fontSize: 24, color: "var(--color-success)" }} />
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--foreground)", margin: 0 }}>Κόστη Υπηρεσιών</h1>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 4 }}>Χρεώσεις API & εργαλείων (τελευταίες 30 μέρες)</p>
        </div>
      </div>

      {error && (
        <div style={{ padding: 16, borderRadius: "var(--radius)", background: "#FEE7E618", border: "1px solid var(--color-danger)", color: "var(--color-danger)", fontSize: 13 }}>{error}</div>
      )}

      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "20px 24px" }}>
        <div style={{ fontSize: 13, color: "var(--muted-foreground)", fontWeight: 500, marginBottom: 8 }}>Σύνολο χρέωσης</div>
        <div style={{ fontSize: 28, fontWeight: 700, color: "var(--foreground)" }}>€{total.toFixed(2)}</div>
      </div>

      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 24 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)", margin: "0 0 16px" }}>Ανά Υπηρεσία</h2>
        {loading ? (
          <div style={{ padding: "24px 0", textAlign: "center", color: "var(--muted-foreground)", fontSize: 13 }}>Φόρτωση…</div>
        ) : items.length === 0 ? (
          <div style={{ padding: "24px 0", textAlign: "center", color: "var(--muted-foreground)", fontSize: 13 }}>Δεν υπάρχουν χρεώσεις ακόμα</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {items.map((it) => (
              <div key={it.apiName} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "var(--bg-canvas)", borderRadius: 6 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: "var(--foreground)" }}>{it.displayName}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--foreground)" }}>€{it.billedCost.toFixed(2)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
