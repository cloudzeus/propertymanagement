"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  RiPriceTag3Line, RiCheckLine, RiErrorWarningLine, RiLoader4Line,
  RiBankCardLine, RiLockLine,
} from "react-icons/ri";
import { listPropertyPackage, setPropertyService } from "@/app/actions/property-package";

// Manager/admin package selection + pay the property's monthly package via the
// PROVIDER's Viva. The amount is ALWAYS server-computed (listPropertyPackage /
// the pay route) — this component never sends an amount.

type PkgService = {
  id: string; name: string; code: string; isCore: boolean;
  pricingModel: string; price: number; enabled: boolean;
};
type PkgView = {
  period: string;
  counts: { units: number; buildings: number; commonAreas: number };
  services: PkgService[];
  total: number;
  totalCents: number;
  invoice: { status: string; paidAt: string | Date | null } | null;
};

const PRICING_LABEL: Record<string, string> = {
  PER_UNIT: "ανά μονάδα", PER_BUILDING: "ανά κτήριο", PER_COMMON_AREA: "ανά κοιν. χώρο",
  FLAT: "σταθερή", METERED_PREPAID: "με μέτρηση",
};

const round2 = (n: number) => Math.round(n * 100) / 100;
function lineFor(s: PkgService, c: PkgView["counts"]): { qty: number | null; amount: number } {
  switch (s.pricingModel) {
    case "PER_UNIT": return { qty: c.units, amount: round2(s.price * c.units) };
    case "PER_BUILDING": return { qty: c.buildings, amount: round2(s.price * c.buildings) };
    case "PER_COMMON_AREA": return { qty: c.commonAreas, amount: round2(s.price * c.commonAreas) };
    case "FLAT": return { qty: 1, amount: round2(s.price) };
    default: return { qty: null, amount: 0 };
  }
}

const eur = (n: number) => `€ ${n.toFixed(2)}`;

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Σε εκκρεμότητα", PAID: "Εξοφλημένο", OVERDUE: "Ληξιπρόθεσμο", CANCELLED: "Ακυρωμένο",
};

export function PropertyPackages({ propertyId, providerConfigured }: { propertyId: string; providerConfigured: boolean }) {
  const [view, setView] = useState<PkgView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  const [payPending, setPayPending] = useState(false);
  const [msg, setMsg] = useState<{ kind: "err"; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const v = (await listPropertyPackage(propertyId)) as PkgView;
      setView(v);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Σφάλμα φόρτωσης");
    }
  }, [propertyId]);

  useEffect(() => { void load(); }, [load]);

  function toggle(s: PkgService, enabled: boolean) {
    // optimistic
    setView((v) => v ? { ...v, services: v.services.map((x) => x.id === s.id ? { ...x, enabled } : x) } : v);
    startTransition(async () => {
      await setPropertyService(propertyId, s.id, enabled);
      await load();
    });
  }

  const paid = view?.invoice?.status === "PAID";

  async function pay() {
    if (!view || paid || !providerConfigured) return;
    setMsg(null);
    setPayPending(true);
    try {
      const res = await fetch("/api/property/package/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId }),
      });
      if (res.ok) {
        const data = (await res.json()) as { checkoutUrl?: string };
        if (data.checkoutUrl) { window.location.href = data.checkoutUrl; return; }
        setMsg({ kind: "err", text: "Δεν επιστράφηκε σύνδεσμος πληρωμής." });
      } else if (res.status === 503) {
        setMsg({ kind: "err", text: "Το Viva του παρόχου δεν έχει ρυθμιστεί." });
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        const map: Record<string, string> = {
          nothing_due: "Δεν υπάρχει οφειλή για το τρέχον πακέτο.",
          already_paid: "Το πακέτο αυτής της περιόδου έχει ήδη εξοφληθεί.",
          viva_order_failed: "Αποτυχία δημιουργίας παραγγελίας Viva.",
        };
        setMsg({ kind: "err", text: map[data.error ?? ""] ?? "Σφάλμα πληρωμής." });
      }
    } catch {
      setMsg({ kind: "err", text: "Σφάλμα δικτύου." });
    } finally {
      setPayPending(false);
    }
  }

  if (loadError) {
    return (
      <div style={card}>
        <div style={alert("err")}>
          <RiErrorWarningLine style={{ fontSize: 16, flexShrink: 0 }} />
          {loadError === "Forbidden" ? "Δεν έχετε πρόσβαση στο πακέτο αυτής της ιδιοκτησίας." : loadError}
        </div>
      </div>
    );
  }

  if (!view) {
    return (
      <div style={{ ...card, display: "flex", alignItems: "center", gap: 8, color: "var(--muted-foreground)", fontSize: 13 }}>
        <RiLoader4Line style={{ fontSize: 16, animation: "ppspin 1s linear infinite" }} /> Φόρτωση…
        <style>{"@keyframes ppspin{to{transform:rotate(360deg)}}"}</style>
      </div>
    );
  }

  const numFont: React.CSSProperties = { fontVariantNumeric: "tabular-nums" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 38, height: 38, borderRadius: 8, background: "var(--color-primary)18", color: "var(--color-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <RiPriceTag3Line style={{ fontSize: 20 }} />
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--foreground)" }}>Πακέτο υπηρεσιών</div>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
            {view.counts.buildings} κτήρια · {view.counts.units} μονάδες · {view.counts.commonAreas} κοιν. χώροι · περίοδος {view.period}
          </div>
        </div>
      </div>

      {/* service list */}
      <div style={card}>
        {view.services.length === 0 && (
          <div style={{ padding: 30, textAlign: "center", color: "var(--muted-foreground)", fontSize: 13 }}>
            Δεν υπάρχουν ενεργές υπηρεσίες στον κατάλογο.
          </div>
        )}
        {view.services.map((s, i) => {
          const { qty, amount } = lineFor(s, view.counts);
          const metered = s.pricingModel === "METERED_PREPAID";
          return (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 16px", borderBottom: i < view.services.length - 1 ? "1px solid var(--border)" : "none" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)", display: "flex", alignItems: "center", gap: 8 }}>
                  {s.name}
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 10, background: s.isCore ? "#0078D418" : "#8764B818", color: s.isCore ? "#0078D4" : "#8764B8" }}>{s.isCore ? "CORE" : "MODULE"}</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2, ...numFont }}>
                  {eur(s.price)} {PRICING_LABEL[s.pricingModel]}
                  {qty != null && !metered && <> · {qty} × {eur(s.price)}</>}
                </div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)", minWidth: 90, textAlign: "right", ...numFont }}>
                {metered ? <span style={{ fontSize: 12, fontWeight: 500, color: "var(--muted-foreground)" }}>με χρήση</span> : eur(amount)}
              </div>
              <Toggle on={s.enabled} onChange={(v) => toggle(s, v)} disabled={busy} />
            </div>
          );
        })}
      </div>

      {/* total + status + pay */}
      <div style={{ ...card, padding: "16px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Μηνιαίο σύνολο (εκτός μετρούμενων)</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "var(--color-primary)", ...numFont }}>{eur(view.total)} <span style={{ fontSize: 13, fontWeight: 600, color: "var(--muted-foreground)" }}>/ μήνα</span></div>
          {view.invoice && (
            <div style={{ marginTop: 6 }}>
              <StatusChip status={view.invoice.status} />
            </div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          <button
            type="button"
            onClick={pay}
            disabled={!providerConfigured || paid || payPending || view.totalCents <= 0}
            style={{
              display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 8,
              border: "none", fontSize: 14, fontWeight: 700, color: "#fff",
              background: (!providerConfigured || paid || view.totalCents <= 0) ? "var(--border-strong)" : "var(--color-primary)",
              cursor: (!providerConfigured || paid || payPending || view.totalCents <= 0) ? "default" : "pointer",
              opacity: payPending ? 0.7 : 1,
            }}
          >
            {payPending ? <RiLoader4Line style={{ animation: "ppspin 1s linear infinite" }} />
              : paid ? <RiCheckLine />
              : !providerConfigured ? <RiLockLine />
              : <RiBankCardLine />}
            {paid ? "Εξοφλημένο" : `Πληρωμή πακέτου ${eur(view.total)}`}
          </button>
          {!providerConfigured && (
            <div style={{ fontSize: 11.5, color: "var(--muted-foreground)", display: "flex", alignItems: "center", gap: 4 }}>
              <RiLockLine /> Το Viva του παρόχου δεν έχει ρυθμιστεί
            </div>
          )}
        </div>
      </div>

      {msg && (
        <div style={alert("err")}>
          <RiErrorWarningLine style={{ fontSize: 16, flexShrink: 0 }} /> {msg.text}
        </div>
      )}
      <style>{"@keyframes ppspin{to{transform:rotate(360deg)}}"}</style>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const tone = status === "PAID" ? { bg: "#16a34a18", fg: "#16a34a" }
    : status === "OVERDUE" ? { bg: "#dc262618", fg: "#dc2626" }
    : status === "CANCELLED" ? { bg: "var(--bg-canvas)", fg: "var(--muted-foreground)" }
    : { bg: "#d9770618", fg: "#d97706" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, padding: "3px 10px", borderRadius: 12, background: tone.bg, color: tone.fg }}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

function Toggle({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={() => !disabled && onChange(!on)} disabled={disabled} style={{
      width: 44, height: 24, borderRadius: 12, border: "none", cursor: disabled ? "default" : "pointer", flexShrink: 0,
      background: on ? "var(--color-primary)" : "var(--border)", position: "relative", transition: "background .15s", opacity: disabled ? 0.6 : 1,
    }}>
      <span style={{ position: "absolute", top: 2, left: on ? 22 : 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left .15s", boxShadow: "0 1px 3px rgba(0,0,0,.3)" }} />
    </button>
  );
}

const card: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" };

function alert(kind: "err"): React.CSSProperties {
  const map = { err: { bg: "#dc262614", fg: "#dc2626", bd: "#dc262630" } }[kind];
  return { display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 8, background: map.bg, color: map.fg, border: `1px solid ${map.bd}`, fontSize: 12.5, lineHeight: 1.4 };
}
