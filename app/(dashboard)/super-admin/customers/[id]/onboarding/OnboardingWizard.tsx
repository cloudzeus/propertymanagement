"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RiDeleteBinLine, RiAddLine, RiSparkling2Line, RiCheckLine, RiArrowRightLine } from "react-icons/ri";
import { AiChatWidget } from "@/components/ai/AiChatWidget";
import { AddressGeocode } from "./AddressGeocode";
import { createBuildingFromOnboarding } from "@/app/actions/building-onboarding";
import { type HeatingType, type UnitTypeStr } from "@/lib/ai/agents/building-onboarding";
import { distributeWeights, elevatorWeight } from "@/lib/millesimes";

type BuildingInfo = {
  address?: string; managerName?: string; heatingType?: HeatingType;
  hasElevator?: boolean; elevatorSurchargePerFloor?: number; elevatorExemptGroundFloor?: boolean;
  city?: string; postalCode?: string; lat?: number; lng?: number;
};
type UnitRow = { unitNumber?: string; floor?: number | null; areaSqm?: number | null; unitType?: UnitTypeStr };
const HEATING_LABEL: Record<HeatingType, string> = { CENTRAL: "Κεντρική", AUTONOMOUS_HOURS: "Αυτονομία (ωρομετρητές)", AUTONOMOUS_METERS: "Αυτονομία (θερμιδομετρητές)", GAS: "Φυσικό αέριο" };
const UNIT_TYPE_LABEL: Record<UnitTypeStr, string> = { APARTMENT: "Διαμέρισμα", SHOP: "Κατάστημα", PARKING: "Parking", OTHER: "Άλλο" };

// Token-styled controls (always follow the app's light Fluent theme — no shadcn slate that flips to black in OS dark mode).
const field = "h-9 w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-2.5 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20";
const fieldSm = "h-8 w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-2 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20";
const lbl = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]";

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
  // Minimum to create: customer + address + at least one unit. Everything else
  // (manager, heating, τ.μ./millesimes) can be filled later in the building detail.
  const complete = !!(selectedCustomerId && info.address && units.length);
  const method =
    info.heatingType === "GAS" ? "ατομική — εκτός κοινοχρήστων"
    : (info.heatingType === "AUTONOMOUS_METERS" || info.heatingType === "AUTONOMOUS_HOURS") ? "70/30 μετρητής"
    : "χιλιοστά θέρμανσης";
  const showCustomerPicker = !customerId && !!customers?.length;

  // Full address (street + ΤΚ + city) for accurate geocoding — a bare street name is ambiguous.
  const geoQuery = [info.address, info.postalCode, info.city].filter(Boolean).join(", ");

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
  const gSumOk = Math.round(mil.gSum) === 1000;
  const eSumOk = Math.round(mil.eSum) === 1000;
  const stepsDone = [!!selectedCustomerId || !showCustomerPicker, !!info.address, !!info.managerName, !!info.heatingType, units.length > 0 && hasArea].filter(Boolean).length;

  return (
    <div className="min-h-full bg-[var(--bg-canvas)]">
      <div className="mx-auto max-w-3xl px-4 py-6 pb-28">
        {/* Header */}
        <header className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-[var(--foreground)]">Νέα πολυκατοικία</h1>
            <p className="mt-0.5 text-[13px] text-[var(--muted-foreground)]">Πες τα στοιχεία στον βοηθό AI (κάτω δεξιά) ή συμπλήρωσέ τα εδώ.</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--card)] px-2.5 py-1 text-[11px] font-medium text-[var(--muted-foreground)]">
            <RiSparkling2Line className="text-[var(--primary)]" /> {stepsDone}/5 βήματα
          </span>
        </header>

        {/* Section 1 — Building */}
        <section className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-[var(--foreground)]">Στοιχεία κτηρίου</h2>

          {showCustomerPicker && (
            <div className="mb-3">
              <label className={lbl}>Πελάτης</label>
              <select className={field} value={selectedCustomerId} onChange={(e) => setSelectedCustomerId(e.target.value)}>
                <option value="">— Επιλέξτε πελάτη —</option>
                {customers!.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={lbl}>Διαχειριστής</label>
              <input className={field} value={info.managerName ?? ""} onChange={(e) => setInfo((f) => ({ ...f, managerName: e.target.value }))} placeholder="Ονοματεπώνυμο" />
            </div>
            <div>
              <label className={lbl}>Θέρμανση</label>
              <select className={field} value={info.heatingType ?? ""} onChange={(e) => setInfo((f) => ({ ...f, heatingType: (e.target.value || undefined) as HeatingType }))}>
                <option value="">— Επιλέξτε —</option>
                {(Object.keys(HEATING_LABEL) as HeatingType[]).map((h) => <option key={h} value={h}>{HEATING_LABEL[h]}</option>)}
              </select>
              {info.heatingType && <span className="mt-1 inline-block rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700">{method}</span>}
            </div>

            <div className="sm:col-span-2">
              <label className={lbl}>Διεύθυνση</label>
              <input className={field} value={info.address ?? ""} onChange={(e) => setInfo((f) => ({ ...f, address: e.target.value }))} placeholder="Οδός & αριθμός" />
            </div>
            <div>
              <label className={lbl}>Πόλη</label>
              <input className={field} value={info.city ?? ""} onChange={(e) => setInfo((f) => ({ ...f, city: e.target.value }))} placeholder="π.χ. Αθήνα" />
            </div>
            <div>
              <label className={lbl}>Τ.Κ.</label>
              <input className={field} value={info.postalCode ?? ""} onChange={(e) => setInfo((f) => ({ ...f, postalCode: e.target.value }))} placeholder="π.χ. 10680" />
            </div>
          </div>

          <AddressGeocode address={geoQuery} onResolved={(r) => setGeo(r ? { city: r.city, postalCode: r.postalCode, lat: r.lat, lng: r.lng } : {})} />

          {/* Elevator */}
          <div className="mt-3 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2.5">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-[var(--foreground)]">
              <input type="checkbox" className="h-4 w-4 accent-[var(--primary)]" checked={!!info.hasElevator} onChange={(e) => setInfo((f) => ({ ...f, hasElevator: e.target.checked }))} />
              Ανελκυστήρας
            </label>
            {info.hasElevator && (
              <div className="mt-2.5 flex flex-wrap items-center gap-x-6 gap-y-2 pl-6">
                <label className="flex items-center gap-2 text-[13px] text-[var(--muted-foreground)]">
                  Επιβάρυνση/όροφο
                  <input type="number" className={`${fieldSm} w-16 text-right`} value={Math.round((info.elevatorSurchargePerFloor ?? 0.1) * 100)} onChange={(e) => setInfo((f) => ({ ...f, elevatorSurchargePerFloor: Number(e.target.value) / 100 }))} /> %
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-[13px] text-[var(--muted-foreground)]">
                  <input type="checkbox" className="h-4 w-4 accent-[var(--primary)]" checked={info.elevatorExemptGroundFloor ?? true} onChange={(e) => setInfo((f) => ({ ...f, elevatorExemptGroundFloor: e.target.checked }))} />
                  Εξαίρεση ισογείου
                </label>
              </div>
            )}
          </div>
        </section>

        {/* Section 2 — Units */}
        <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--foreground)]">Μονάδες <span className="text-[var(--muted-foreground)]">({units.length})</span></h2>
            <button type="button" onClick={addUnit} className="inline-flex h-8 items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--card)] px-2.5 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--bg-canvas)]">
              <RiAddLine /> Μονάδα
            </button>
          </div>

          {units.length === 0 ? (
            <div className="rounded-md border border-dashed border-[var(--border)] px-3 py-6 text-center text-[13px] text-[var(--muted-foreground)]">
              Καμία μονάδα ακόμη — πρόσθεσε ή πες τις στον βοηθό AI.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-y-1 text-sm">
                <thead>
                  <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                    <th className="px-1 pb-1 font-semibold">Αρ.</th>
                    <th className="px-1 pb-1 font-semibold">Όροφος</th>
                    <th className="px-1 pb-1 font-semibold">τ.μ.</th>
                    <th className="px-1 pb-1 font-semibold">Τύπος</th>
                    <th className="px-1 pb-1 text-right font-semibold">Γεν.‰</th>
                    <th className="px-1 pb-1 text-right font-semibold">Ανελ.‰</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {units.map((u, i) => {
                    const missingArea = !((u.areaSqm ?? 0) > 0);
                    return (
                      <tr key={i}>
                        <td className="px-1"><input className={`${fieldSm} w-14`} value={u.unitNumber ?? ""} placeholder={String(i + 1)} onChange={(e) => setUnit(i, { unitNumber: e.target.value })} /></td>
                        <td className="px-1"><input className={`${fieldSm} w-16 text-right`} type="number" value={u.floor ?? ""} onChange={(e) => setUnit(i, { floor: num(e.target.value) as number | null })} /></td>
                        <td className="px-1"><input className={`${fieldSm} w-20 text-right ${missingArea ? "border-red-300" : ""}`} type="number" value={u.areaSqm ?? ""} placeholder="—" onChange={(e) => setUnit(i, { areaSqm: num(e.target.value) })} /></td>
                        <td className="px-1">
                          <select className={`${fieldSm} w-32`} value={u.unitType ?? "APARTMENT"} onChange={(e) => setUnit(i, { unitType: e.target.value as UnitTypeStr })}>
                            {(Object.keys(UNIT_TYPE_LABEL) as UnitTypeStr[]).map((t) => <option key={t} value={t}>{UNIT_TYPE_LABEL[t]}</option>)}
                          </select>
                        </td>
                        <td className={`px-1 text-right tabular-nums ${missingArea ? "text-red-500" : "text-[var(--foreground)]"}`}>{mil.g.get(String(i)) ?? "—"}</td>
                        <td className="px-1 text-right tabular-nums text-[var(--muted-foreground)]">{mil.e ? (mil.e.get(String(i)) ?? (missingArea ? "—" : 0)) : "—"}</td>
                        <td className="px-1 text-right">
                          <button type="button" onClick={() => removeUnit(i)} aria-label="Διαγραφή" className="inline-flex h-7 w-7 items-center justify-center rounded text-[var(--muted-foreground)] transition-colors hover:bg-red-50 hover:text-red-600">
                            <RiDeleteBinLine />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="text-[13px] font-semibold">
                    <td className="px-1 pt-1" colSpan={4}>Σύνολο</td>
                    <td className={`px-1 pt-1 text-right tabular-nums ${gSumOk ? "text-emerald-600" : "text-red-500"}`}>{Math.round(mil.gSum)}{gSumOk && <RiCheckLine className="ml-0.5 inline" />}</td>
                    <td className={`px-1 pt-1 text-right tabular-nums ${!mil.e ? "text-[var(--muted-foreground)]" : eSumOk ? "text-emerald-600" : "text-red-500"}`}>{mil.e ? Math.round(mil.eSum) : "—"}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </section>

        {err && <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
      </div>

      {/* Sticky footer action bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--card)]/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <span className="text-[13px] text-[var(--muted-foreground)]">{complete ? "Έτοιμο — τα υπόλοιπα (τ.μ., θέρμανση) μπαίνουν μετά" : "Χρειάζονται: πελάτης, διεύθυνση και ≥1 μονάδα"}</span>
          <button onClick={create} disabled={!complete || pending} className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md bg-[var(--primary)] px-5 text-sm font-medium text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">
            {pending ? "Δημιουργία…" : <>Δημιουργία <RiArrowRightLine /></>}
          </button>
        </div>
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
    </div>
  );
}
