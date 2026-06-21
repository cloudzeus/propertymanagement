"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AiChatWidget } from "@/components/ai/AiChatWidget";
import { AddressGeocode } from "./AddressGeocode";
import { createBuildingFromOnboarding } from "@/app/actions/building-onboarding";
import { type HeatingType, type UnitTypeStr } from "@/lib/ai/agents/building-onboarding";
import { distributeWeights, elevatorWeight } from "@/lib/millesimes";

type BuildingInfo = { address?: string; managerName?: string; heatingType?: HeatingType; hasElevator?: boolean; elevatorSurchargePerFloor?: number; elevatorExemptGroundFloor?: boolean };
type UnitRow = { unitNumber?: string; floor?: number | null; areaSqm?: number | null; unitType?: UnitTypeStr };
const HEATING_LABEL: Record<HeatingType, string> = { CENTRAL: "Κεντρική", AUTONOMOUS_HOURS: "Αυτονομία (ωρομετρητές)", AUTONOMOUS_METERS: "Αυτονομία (θερμιδομετρητές)", GAS: "Φυσικό αέριο" };

export function OnboardingWizard({ customerId, customerName, customers }: { customerId?: string; customerName?: string; customers?: { id: string; name: string }[] }) {
  const router = useRouter();
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(customerId ?? "");
  const [info, setInfo] = useState<BuildingInfo>({ hasElevator: false, elevatorSurchargePerFloor: 0.1, elevatorExemptGroundFloor: true });
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [geo, setGeo] = useState<{ city?: string; postalCode?: string; lat?: number; lng?: number }>({});
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  // Live millesimes (pure libs)
  const mil = useMemo(() => {
    const surcharge = info.elevatorSurchargePerFloor ?? 0.1;
    const exempt = info.elevatorExemptGroundFloor ?? true;
    const g = new Map(distributeWeights(units.map((u, i) => ({ id: String(i), weight: u.areaSqm ?? 0 }))).map((r) => [r.id, r.value] as [string, number | null]));
    const e = info.hasElevator ? new Map(distributeWeights(units.map((u, i) => ({ id: String(i), weight: elevatorWeight(u.areaSqm ?? 0, u.floor ?? null, surcharge, exempt) }))).map((r) => [r.id, r.value] as [string, number | null])) : null;
    const sum = (m: Map<string, number | null>) => [...m.values()].reduce((s: number, v) => s + (v ?? 0), 0);
    return { g, e, gSum: sum(g), eSum: e ? sum(e) : 0 };
  }, [units, info.hasElevator, info.elevatorSurchargePerFloor, info.elevatorExemptGroundFloor]);

  const setUnit = (i: number, patch: Partial<UnitRow>) => setUnits((us) => us.map((u, j) => (j === i ? { ...u, ...patch } : u)));
  const addUnit = () => setUnits((us) => [...us, { unitType: "APARTMENT" }]);
  const removeUnit = (i: number) => setUnits((us) => us.filter((_, j) => j !== i));

  const hasArea = units.some((u) => (u.areaSqm ?? 0) > 0);
  const complete = !!(selectedCustomerId && info.address && info.managerName && info.heatingType && units.length && hasArea);
  const method =
    info.heatingType === "GAS" ? "ατομική — εκτός κοινοχρήστων"
    : (info.heatingType === "AUTONOMOUS_METERS" || info.heatingType === "AUTONOMOUS_HOURS") ? "70/30 μετρητής"
    : "χιλιοστά θέρμανσης";
  const showCustomerPicker = !customerId && !!customers?.length;

  function create() {
    setErr(null);
    if (!selectedCustomerId) { setErr("Επιλέξτε πελάτη."); return; }
    startTransition(async () => {
      const res = await createBuildingFromOnboarding(selectedCustomerId, { building: { ...info, ...geo }, units });
      if ("error" in res) { setErr(res.error); return; }
      router.push(`/super-admin/buildings/${res.buildingId}`);
    });
  }

  const num = (v: string) => (v === "" ? null : Number(v));

  return (
    <>
      {/* Full-width body: building fields + units table */}
      <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Στοιχεία κτηρίου <span style={{ fontSize: 11, color: "#16a34a" }}>● live</span></div>
        {showCustomerPicker && (
          <label style={{ display: "block", marginBottom: 6 }}>Πελάτης
            <select value={selectedCustomerId} onChange={(e) => setSelectedCustomerId(e.target.value)}>
              <option value="">— Επιλέξτε πελάτη —</option>
              {customers!.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        )}
        <label style={{ display: "block", marginBottom: 6 }}>Διαχειριστής <input value={info.managerName ?? ""} onChange={(e) => setInfo((f) => ({ ...f, managerName: e.target.value }))} /></label>
        <label style={{ display: "block", marginBottom: 6 }}>Διεύθυνση <input value={info.address ?? ""} onChange={(e) => setInfo((f) => ({ ...f, address: e.target.value }))} /></label>
        <AddressGeocode address={info.address} onResolved={(r) => setGeo(r ? { city: r.city, postalCode: r.postalCode, lat: r.lat, lng: r.lng } : {})} />
        <label style={{ display: "block", marginBottom: 6 }}>Θέρμανση
          <select value={info.heatingType ?? ""} onChange={(e) => setInfo((f) => ({ ...f, heatingType: (e.target.value || undefined) as HeatingType }))}>
            <option value="">—</option>
            {(Object.keys(HEATING_LABEL) as HeatingType[]).map((h) => <option key={h} value={h}>{HEATING_LABEL[h]}</option>)}
          </select>
          {info.heatingType && <span style={{ fontSize: 11, color: "#f59e0b" }}> → {method}</span>}
        </label>
        <label style={{ display: "block", marginBottom: 6 }}>
          <input type="checkbox" checked={!!info.hasElevator} onChange={(e) => setInfo((f) => ({ ...f, hasElevator: e.target.checked }))} /> Ανελκυστήρας
        </label>
        {info.hasElevator && (
          <div style={{ display: "flex", gap: 12, fontSize: 13, marginBottom: 6 }}>
            <label>Επιβάρυνση/όροφο %
              <input type="number" style={{ width: 70 }} value={Math.round((info.elevatorSurchargePerFloor ?? 0.1) * 100)} onChange={(e) => setInfo((f) => ({ ...f, elevatorSurchargePerFloor: Number(e.target.value) / 100 }))} />
            </label>
            <label><input type="checkbox" checked={info.elevatorExemptGroundFloor ?? true} onChange={(e) => setInfo((f) => ({ ...f, elevatorExemptGroundFloor: e.target.checked }))} /> Εξαίρεση ισογείου</label>
          </div>
        )}

        <div style={{ fontWeight: 700, margin: "14px 0 6px" }}>Μονάδες</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr style={{ background: "#f4f4f6", textAlign: "right" }}>
            <th style={{ textAlign: "left", padding: 6 }}>Αρ.</th><th>Όροφος</th><th>τ.μ.</th><th>Τύπος</th><th>Γεν.‰</th><th>Ανελ.‰</th><th></th>
          </tr></thead>
          <tbody>
            {units.map((u, i) => (
              <tr key={i} style={{ borderTop: "1px solid #eee", textAlign: "right" }}>
                <td style={{ textAlign: "left" }}><input style={{ width: 50 }} value={u.unitNumber ?? ""} placeholder={String(i + 1)} onChange={(e) => setUnit(i, { unitNumber: e.target.value })} /></td>
                <td><input style={{ width: 50 }} type="number" value={u.floor ?? ""} onChange={(e) => setUnit(i, { floor: num(e.target.value) as number | null })} /></td>
                <td><input style={{ width: 60 }} type="number" value={u.areaSqm ?? ""} onChange={(e) => setUnit(i, { areaSqm: num(e.target.value) })} /></td>
                <td>
                  <select value={u.unitType ?? "APARTMENT"} onChange={(e) => setUnit(i, { unitType: e.target.value as UnitTypeStr })}>
                    <option value="APARTMENT">Διαμέρισμα</option><option value="SHOP">Κατάστημα</option><option value="PARKING">Parking</option><option value="OTHER">Άλλο</option>
                  </select>
                </td>
                <td style={{ color: (u.areaSqm ?? 0) > 0 ? undefined : "#c00" }}>{mil.g.get(String(i)) ?? "—"}</td>
                <td>{mil.e ? (mil.e.get(String(i)) ?? ((u.areaSqm ?? 0) > 0 ? 0 : "—")) : "—"}</td>
                <td><button type="button" onClick={() => removeUnit(i)}>✕</button></td>
              </tr>
            ))}
            <tr style={{ borderTop: "2px solid #ddd", fontWeight: 700, background: "#fafafa", textAlign: "right" }}>
              <td style={{ textAlign: "left", padding: 6 }}>Σύνολο</td><td></td><td></td><td></td>
              <td style={{ color: Math.round(mil.gSum) === 1000 ? "#0a8" : "#c00" }}>{Math.round(mil.gSum)}</td>
              <td style={{ color: !mil.e ? "#999" : Math.round(mil.eSum) === 1000 ? "#0a8" : "#c00" }}>{mil.e ? Math.round(mil.eSum) : "—"}</td><td></td>
            </tr>
          </tbody>
        </table>
        <button type="button" onClick={addUnit} style={{ marginTop: 8 }}>+ Μονάδα</button>

        {err && <div style={{ color: "#c00", marginTop: 10 }}>{err}</div>}
        <button onClick={create} disabled={!complete || pending} style={{ marginTop: 14, width: "100%" }}>
          {pending ? "Δημιουργία…" : "Δημιουργία & συνέχεια στις λεπτομέρειες →"}
        </button>
      </div>

      <AiChatWidget
        agentKey="building-onboarding"
        title={`AI Onboarding${customerName ? ` — ${customerName}` : ""}`}
        greeting="Περιγράψτε το κτήριο και τις μονάδες (όροφοι, τ.μ.), τη θέρμανση και τον ανελκυστήρα."
        quickReplies={["Έχει ασανσέρ", "Κεντρική θέρμανση", "Δεν ξέρω, βοήθησέ με"]}
        onToolCall={(name, args) => {
          if (name === "updateBuildingOnboardingData") setInfo((f) => ({ ...f, ...(args as BuildingInfo) }));
          else if (name === "setUnits") setUnits(((args as { units?: UnitRow[] }).units ?? []).map((u) => ({ ...u })));
        }}
      />
    </>
  );
}
