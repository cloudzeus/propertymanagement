"use client";

import { useState } from "react";
import { RiBankCardLine, RiSecurePaymentLine, RiCheckLine, RiTimeLine } from "react-icons/ri";

export type QuickPayUnit = { unitId: string; unitNumber: string; amountCents: number };
export type QuickPayProps = {
  buildingId: string;
  perUnit: QuickPayUnit[];
  totalCents: number;
  enabled: boolean;
};

const eurCents = (c: number) =>
  `${(c / 100).toLocaleString("el-GR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

const card: React.CSSProperties = {
  background: "var(--card)", border: "1px solid var(--border)",
  borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-card)", padding: 18,
};
const cardCaps: React.CSSProperties = {
  fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: "var(--muted-foreground)",
};

/**
 * Occupant quick-pay card for the Επισκόπηση section. Per-unit «Πληρωμή με Viva»
 * buttons + a «Πληρωμή όλων» when >1 unit owes. Amounts are display-only — the
 * server recomputes them on both the intent and the callback. When the feature
 * flag is OFF the buttons are disabled with «Σύντομα διαθέσιμο».
 */
export function QuickPayCard({ buildingId, perUnit, totalCents, enabled }: QuickPayProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const owing = perUnit.filter((u) => u.amountCents > 0);
  const settled = perUnit.filter((u) => u.amountCents <= 0);

  async function pay(scope: string, body: { buildingId: string; unitId?: string }) {
    if (!enabled) return;
    setError(null);
    setBusy(scope);
    try {
      const res = await fetch("/api/koinochrista/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 503) {
        setError("Οι online πληρωμές δεν είναι ακόμη διαθέσιμες.");
        return;
      }
      if (!res.ok) {
        setError("Δεν ήταν δυνατή η έναρξη της πληρωμής. Δοκιμάστε ξανά.");
        return;
      }
      const data = (await res.json()) as { checkoutUrl?: string };
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      setError("Δεν ήταν δυνατή η έναρξη της πληρωμής. Δοκιμάστε ξανά.");
    } catch {
      setError("Σφάλμα δικτύου. Δοκιμάστε ξανά.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <RiSecurePaymentLine style={{ fontSize: 17, color: "var(--color-primary)" }} />
        <span style={cardCaps}>Γρήγορη πληρωμή κοινοχρήστων</span>
      </div>

      {owing.length === 0 ? (
        <div style={{ fontSize: 13.5, color: "var(--muted-foreground)", marginTop: 12 }}>
          Δεν υπάρχουν εκκρεμείς οφειλές.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
          {owing.map((u) => (
            <div key={u.unitId} style={payRow}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--foreground)" }}>Μονάδα {u.unitNumber}</span>
                <span style={{ fontSize: 15, fontWeight: 800, fontVariantNumeric: "tabular-nums", color: "var(--foreground)" }}>
                  {eurCents(u.amountCents)}
                </span>
              </div>
              <PayButton
                disabled={!enabled}
                busy={busy === u.unitId}
                onClick={() => pay(u.unitId, { buildingId, unitId: u.unitId })}
              />
            </div>
          ))}

          {owing.length > 1 && (
            <button
              type="button"
              disabled={!enabled || busy != null}
              onClick={() => pay("all", { buildingId })}
              title={!enabled ? "Σύντομα διαθέσιμο" : undefined}
              style={payAllBtn(enabled)}
            >
              <RiBankCardLine style={{ fontSize: 17 }} />
              {busy === "all" ? "Μεταφορά…" : `Πληρωμή όλων ${eurCents(totalCents)}`}
            </button>
          )}
        </div>
      )}

      {settled.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
          {settled.map((u) => (
            <span key={u.unitId} style={settledChip}>
              <RiCheckLine style={{ fontSize: 13 }} /> Μονάδα {u.unitNumber} · Εξοφλημένο
            </span>
          ))}
        </div>
      )}

      {!enabled && owing.length > 0 && (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted-foreground)", marginTop: 12 }}>
          <RiTimeLine /> Οι online πληρωμές θα είναι σύντομα διαθέσιμες.
        </div>
      )}

      {error && (
        <div style={{ fontSize: 12.5, color: "var(--color-danger, #b42318)", marginTop: 10 }}>{error}</div>
      )}
    </div>
  );
}

function PayButton({ disabled, busy, onClick }: { disabled: boolean; busy: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled || busy}
      onClick={onClick}
      title={disabled ? "Σύντομα διαθέσιμο" : undefined}
      style={payBtn(!disabled)}
    >
      <RiBankCardLine style={{ fontSize: 16 }} />
      {busy ? "Μεταφορά…" : "Πληρωμή με Viva"}
    </button>
  );
}

const payRow: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
  padding: "10px 12px", borderRadius: 9, border: "1px solid var(--border)", background: "var(--bg-canvas)",
};

const payBtn = (active: boolean): React.CSSProperties => ({
  display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 14px", borderRadius: 9,
  border: `1px solid ${active ? "var(--color-primary)" : "var(--border)"}`,
  background: active ? "var(--color-primary)" : "var(--bg-muted, var(--bg-canvas))",
  color: active ? "#fff" : "var(--muted-foreground)",
  fontSize: 13, fontWeight: 700, cursor: active ? "pointer" : "not-allowed", whiteSpace: "nowrap",
});

const payAllBtn = (active: boolean): React.CSSProperties => ({
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px 14px", borderRadius: 9,
  border: `1px solid ${active ? "var(--color-primary)" : "var(--border)"}`,
  background: active ? "var(--color-primary)" : "var(--bg-muted, var(--bg-canvas))",
  color: active ? "#fff" : "var(--muted-foreground)",
  fontSize: 13.5, fontWeight: 800, fontVariantNumeric: "tabular-nums",
  cursor: active ? "pointer" : "not-allowed", width: "100%",
});

const settledChip: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 999,
  background: "color-mix(in srgb, var(--color-success, #12805c) 12%, transparent)",
  color: "var(--color-success, #12805c)", fontSize: 11.5, fontWeight: 700,
};
