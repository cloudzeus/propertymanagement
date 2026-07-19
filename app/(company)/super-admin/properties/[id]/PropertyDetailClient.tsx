"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { BuildingsTree, type TBuilding, type TPropertyAddress } from "../../customers/CustomerTree";
import { setPropertyService, addPrepaidMinutes } from "@/app/actions/property-package";
import { RiArrowLeftLine, RiAddLine } from "react-icons/ri";
import { ManagedBadge } from "@/components/ui/managed-badge";
import { PropertyVivaSetup } from "@/components/property/PropertyVivaSetup";

const PRICING_LABEL: Record<string, string> = {
  PER_UNIT: "ανά μονάδα", PER_BUILDING: "ανά κτήριο", PER_COMMON_AREA: "ανά κοιν. χώρο",
  FLAT: "σταθερή", METERED_PREPAID: "με μέτρηση",
};

type CatalogService = { id: string; name: string; code: string; isCore: boolean; pricingModel: string; price: number };
type PS = { serviceId: string; active: boolean; prepaidPersonMinutes: number };

export function PropertyDetailClient({
  property, buildings, catalog, propertyServices: initialPS,
}: {
  property: { id: string; name: string; customerName: string; managed: boolean } & TPropertyAddress;
  buildings: TBuilding[];
  catalog: CatalogService[];
  propertyServices: PS[];
}) {
  const [tab, setTab] = useState<"buildings" | "package" | "viva">("buildings");
  const [ps, setPs] = useState<PS[]>(initialPS);

  const counts = useMemo(() => ({
    buildings: buildings.length,
    units: buildings.reduce((s, b) => s + b.units.length, 0),
    commonAreas: buildings.reduce((s, b) => s + b.commonAreas.length, 0),
  }), [buildings]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Link href="/super-admin/properties" style={{ fontSize: 12, color: "var(--muted-foreground)", display: "flex", alignItems: "center", gap: 4, textDecoration: "none" }}>
        <RiArrowLeftLine /> Πίσω στις Ιδιοκτησίες
      </Link>

      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--foreground)", margin: 0 }}>{property.name}</h1>
          <ManagedBadge managed={property.managed} />
        </div>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 4 }}>
          Πελάτης: {property.customerName} · {counts.buildings} κτήρια · {counts.units} μονάδες · {counts.commonAreas} κοιν. χώροι
        </p>
      </div>

      <div style={{ display: "flex", gap: 4, padding: 4, background: "var(--bg-canvas)", borderRadius: 6, border: "1px solid var(--border)", width: "fit-content" }}>
        {([["buildings", "Κτήρια & Μονάδες"], ["package", "Πακέτο Υπηρεσιών"], ["viva", "Viva πληρωμές"]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            padding: "6px 16px", borderRadius: 4, fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer",
            background: tab === k ? "var(--color-primary)" : "transparent", color: tab === k ? "#fff" : "var(--muted-foreground)",
          }}>{label}</button>
        ))}
      </div>

      {tab === "buildings" ? (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, padding: 12 }}>
          <BuildingsTree propertyId={property.id} buildings={buildings} depthBase={0} propertyAddress={property} />
        </div>
      ) : tab === "package" ? (
        <PackageTab propertyId={property.id} catalog={catalog} ps={ps} setPs={setPs} counts={counts} />
      ) : (
        <PropertyVivaSetup propertyId={property.id} />
      )}

      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ─── Package tab ───────────────────────────────────────────────────────────────
function PackageTab({ propertyId, catalog, ps, setPs, counts }: {
  propertyId: string; catalog: CatalogService[]; ps: PS[]; setPs: React.Dispatch<React.SetStateAction<PS[]>>;
  counts: { buildings: number; units: number; commonAreas: number };
}) {
  const [, startTransition] = useTransition();
  const psMap = useMemo(() => Object.fromEntries(ps.map((p) => [p.serviceId, p])), [ps]);

  function monthlyEstimate(s: CatalogService): string {
    switch (s.pricingModel) {
      case "PER_UNIT": return `€ ${(s.price * counts.units).toFixed(2)}`;
      case "PER_BUILDING": return `€ ${(s.price * counts.buildings).toFixed(2)}`;
      case "PER_COMMON_AREA": return `€ ${(s.price * counts.commonAreas).toFixed(2)}`;
      case "FLAT": return `€ ${s.price.toFixed(2)}`;
      case "METERED_PREPAID": return "με χρήση";
      default: return "—";
    }
  }

  function toggle(s: CatalogService, enabled: boolean) {
    setPs((prev) => {
      const exists = prev.find((p) => p.serviceId === s.id);
      if (exists) return prev.map((p) => p.serviceId === s.id ? { ...p, active: enabled } : p);
      return [...prev, { serviceId: s.id, active: enabled, prepaidPersonMinutes: 0 }];
    });
    startTransition(async () => { await setPropertyService(propertyId, s.id, enabled); });
  }

  function addPrepaid(s: CatalogService, minutes: number) {
    startTransition(async () => {
      const res = await addPrepaidMinutes(propertyId, s.id, minutes);
      if ("prepaidPersonMinutes" in res) {
        setPs((prev) => {
          const exists = prev.find((p) => p.serviceId === s.id);
          if (exists) return prev.map((p) => p.serviceId === s.id ? { ...p, prepaidPersonMinutes: res.prepaidPersonMinutes!, active: true } : p);
          return [...prev, { serviceId: s.id, active: true, prepaidPersonMinutes: res.prepaidPersonMinutes! }];
        });
      }
    });
  }

  const monthlyTotal = catalog.reduce((sum, s) => {
    const on = psMap[s.id]?.active;
    if (!on) return sum;
    if (s.pricingModel === "PER_UNIT") return sum + s.price * counts.units;
    if (s.pricingModel === "PER_BUILDING") return sum + s.price * counts.buildings;
    if (s.pricingModel === "PER_COMMON_AREA") return sum + s.price * counts.commonAreas;
    if (s.pricingModel === "FLAT") return sum + s.price;
    return sum;
  }, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ ...card, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Εκτιμώμενη μηνιαία χρέωση (εκτός μετρούμενων)</span>
        <span style={{ fontSize: 20, fontWeight: 700, color: "var(--color-primary)" }}>€ {monthlyTotal.toFixed(2)} / μήνα</span>
      </div>

      {catalog.length === 0 && <div style={{ ...card, padding: 30, textAlign: "center", color: "var(--muted-foreground)", fontSize: 13 }}>Δεν υπάρχουν ενεργές υπηρεσίες στον κατάλογο.</div>}

      <div style={card}>
        {catalog.map((s, i) => {
          const cur = psMap[s.id];
          const on = !!cur?.active;
          return (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderBottom: i < catalog.length - 1 ? "1px solid var(--border)" : "none" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)", display: "flex", alignItems: "center", gap: 8 }}>
                  {s.name}
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 10, background: s.isCore ? "#0078D418" : "#8764B818", color: s.isCore ? "#0078D4" : "#8764B8" }}>{s.isCore ? "CORE" : "MODULE"}</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>
                  € {s.price.toFixed(2)} {PRICING_LABEL[s.pricingModel]} · εκτίμηση: <strong style={{ color: "var(--foreground)" }}>{monthlyEstimate(s)}</strong>
                </div>
                {s.pricingModel === "METERED_PREPAID" && (
                  <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 6, display: "flex", alignItems: "center", gap: 8 }}>
                    Υπόλοιπο προαγοράς: <strong style={{ color: "var(--foreground)" }}>{((cur?.prepaidPersonMinutes ?? 0) / 60).toFixed(1)} ώρες-ατόμου</strong>
                    <PrepaidAdder onAdd={(h) => addPrepaid(s, h * 60)} />
                  </div>
                )}
              </div>
              <Toggle on={on} onChange={(v) => toggle(s, v)} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PrepaidAdder({ onAdd }: { onAdd: (hours: number) => void }) {
  const [hours, setHours] = useState("");
  return (
    <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
      <input value={hours} onChange={(e) => setHours(e.target.value)} type="number" placeholder="ώρες-ατόμου"
        style={{ width: 110, height: 26, padding: "0 8px", fontSize: 12, border: "1px solid var(--border)", borderRadius: 4, background: "var(--card)", color: "var(--foreground)" }} />
      <button onClick={() => { const h = parseFloat(hours); if (h > 0) { onAdd(h); setHours(""); } }} style={smallBtn}><RiAddLine /> Προσθήκη</button>
    </span>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} style={{
      width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer", flexShrink: 0,
      background: on ? "var(--color-primary)" : "var(--border)", position: "relative", transition: "background .15s",
    }}>
      <span style={{ position: "absolute", top: 2, left: on ? 22 : 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left .15s", boxShadow: "0 1px 3px rgba(0,0,0,.3)" }} />
    </button>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 12, background: "var(--bg-canvas)", border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>{children}</span>;
}

// ─── shared styles ─────────────────────────────────────────────────────────────
const yesNo = [{ value: "false", label: "Όχι" }, { value: "true", label: "Ναι" }];
const card: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" };
const primaryBtn: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 6, fontSize: 13, fontWeight: 600, background: "var(--color-primary)", color: "#fff", border: "none", cursor: "pointer", width: "fit-content" };
const smallBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 5, fontSize: 11, fontWeight: 600, border: "1px solid var(--border)", background: "var(--card)", cursor: "pointer", color: "var(--foreground)" };
const iconBtn: React.CSSProperties = { background: "none", border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer", color: "var(--color-primary)", fontSize: 15, display: "flex", padding: 6 };
const iconBtnSm: React.CSSProperties = { background: "none", border: "none", cursor: "pointer", color: "var(--color-primary)", fontSize: 14, padding: 3 };
const th: React.CSSProperties = { textAlign: "left", padding: "6px 8px", fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)", textTransform: "uppercase" };
const td: React.CSSProperties = { padding: "7px 8px", fontSize: 13, color: "var(--foreground)" };
const cancelBtn: React.CSSProperties = { padding: "7px 16px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--card)", cursor: "pointer", fontSize: 13, color: "var(--foreground)" };
const saveBtn: React.CSSProperties = { padding: "7px 16px", borderRadius: 6, border: "none", background: "var(--color-primary)", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 };
const errBox: React.CSSProperties = { padding: "8px 12px", borderRadius: 6, background: "#fee2e218", color: "#dc2626", fontSize: 12, border: "1px solid #fca5a530", marginBottom: 14 };
