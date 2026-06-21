"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RiDeleteBinLine, RiAddLine } from "react-icons/ri";
import { AiChatWidget } from "@/components/ai/AiChatWidget";
import { AddressGeocode } from "./AddressGeocode";
import { createBuildingFromOnboarding } from "@/app/actions/building-onboarding";
import { type HeatingType, type UnitTypeStr } from "@/lib/ai/agents/building-onboarding";
import { distributeWeights, elevatorWeight } from "@/lib/millesimes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

type BuildingInfo = { address?: string; managerName?: string; heatingType?: HeatingType; hasElevator?: boolean; elevatorSurchargePerFloor?: number; elevatorExemptGroundFloor?: boolean };
type UnitRow = { unitNumber?: string; floor?: number | null; areaSqm?: number | null; unitType?: UnitTypeStr };
const HEATING_LABEL: Record<HeatingType, string> = { CENTRAL: "Κεντρική", AUTONOMOUS_HOURS: "Αυτονομία (ωρομετρητές)", AUTONOMOUS_METERS: "Αυτονομία (θερμιδομετρητές)", GAS: "Φυσικό αέριο" };
const UNIT_TYPE_LABEL: Record<UnitTypeStr, string> = { APARTMENT: "Διαμέρισμα", SHOP: "Κατάστημα", PARKING: "Parking", OTHER: "Άλλο" };

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

  const gSumOk = Math.round(mil.gSum) === 1000;
  const eSumOk = Math.round(mil.eSum) === 1000;

  return (
    <>
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        {/* Page header */}
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">Νέα πολυκατοικία</h1>
          <p className="text-sm text-[var(--muted-foreground)]">Συμπληρώστε τα στοιχεία ή πείτε τα στον βοηθό AI κάτω δεξιά.</p>
        </header>

        {/* Section 1 — Building details */}
        <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
          <div className="mb-4 flex items-center gap-2">
            <h2 className="text-base font-semibold text-[var(--foreground)]">Στοιχεία κτηρίου</h2>
            <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> live
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {showCustomerPicker && (
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Πελάτης</Label>
                <Select value={selectedCustomerId} onValueChange={(v) => setSelectedCustomerId(v)}>
                  <SelectTrigger><SelectValue placeholder="— Επιλέξτε πελάτη —" /></SelectTrigger>
                  <SelectContent>
                    {customers!.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="ob-manager">Διαχειριστής</Label>
              <Input id="ob-manager" value={info.managerName ?? ""} onChange={(e) => setInfo((f) => ({ ...f, managerName: e.target.value }))} placeholder="Ονοματεπώνυμο διαχειριστή" />
            </div>

            <div className="space-y-1.5">
              <Label>Θέρμανση</Label>
              <Select value={info.heatingType ?? ""} onValueChange={(v) => setInfo((f) => ({ ...f, heatingType: (v || undefined) as HeatingType }))}>
                <SelectTrigger><SelectValue placeholder="— Επιλέξτε —" /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(HEATING_LABEL) as HeatingType[]).map((h) => <SelectItem key={h} value={h}>{HEATING_LABEL[h]}</SelectItem>)}
                </SelectContent>
              </Select>
              {info.heatingType && (
                <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
                  {method}
                </span>
              )}
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ob-address">Διεύθυνση</Label>
              <Input id="ob-address" value={info.address ?? ""} onChange={(e) => setInfo((f) => ({ ...f, address: e.target.value }))} placeholder="Οδός, αριθμός, περιοχή" />
              <div className="mt-2 overflow-hidden rounded-md border border-[var(--border)]">
                <AddressGeocode address={info.address} onResolved={(r) => setGeo(r ? { city: r.city, postalCode: r.postalCode, lat: r.lat, lng: r.lng } : {})} />
              </div>
            </div>
          </div>

          {/* Elevator */}
          <div className="mt-5 rounded-md border border-[var(--border)] bg-[var(--bg-canvas)] p-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-[var(--foreground)]">
              <input type="checkbox" className="h-4 w-4 accent-[var(--primary)]" checked={!!info.hasElevator} onChange={(e) => setInfo((f) => ({ ...f, hasElevator: e.target.checked }))} />
              Ανελκυστήρας
            </label>
            {info.hasElevator && (
              <div className="mt-3 flex flex-wrap items-end gap-6">
                <div className="space-y-1.5">
                  <Label htmlFor="ob-surcharge">Επιβάρυνση/όροφο %</Label>
                  <Input id="ob-surcharge" type="number" className="h-9 w-28" value={Math.round((info.elevatorSurchargePerFloor ?? 0.1) * 100)} onChange={(e) => setInfo((f) => ({ ...f, elevatorSurchargePerFloor: Number(e.target.value) / 100 }))} />
                </div>
                <label className="flex h-9 cursor-pointer items-center gap-2 text-sm text-[var(--foreground)]">
                  <input type="checkbox" className="h-4 w-4 accent-[var(--primary)]" checked={info.elevatorExemptGroundFloor ?? true} onChange={(e) => setInfo((f) => ({ ...f, elevatorExemptGroundFloor: e.target.checked }))} />
                  Εξαίρεση ισογείου
                </label>
              </div>
            )}
          </div>
        </section>

        {/* Section 2 — Units */}
        <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
          <h2 className="mb-4 text-base font-semibold text-[var(--foreground)]">Μονάδες</h2>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-[var(--muted-foreground)]">
                  <th className="px-2 py-2 font-medium">Αρ.</th>
                  <th className="px-2 py-2 font-medium">Όροφος</th>
                  <th className="px-2 py-2 font-medium">τ.μ.</th>
                  <th className="px-2 py-2 font-medium">Τύπος</th>
                  <th className="px-2 py-2 text-right font-medium">Γεν.‰</th>
                  <th className="px-2 py-2 text-right font-medium">Ανελ.‰</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {units.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-2 py-6 text-center text-[var(--muted-foreground)]">Δεν υπάρχουν μονάδες ακόμη.</td>
                  </tr>
                )}
                {units.map((u, i) => {
                  const missingArea = !((u.areaSqm ?? 0) > 0);
                  return (
                    <tr key={i} className="border-b border-[var(--border)] hover:bg-[var(--card-hover)]">
                      <td className="px-2 py-2">
                        <Input className="h-8 w-16" value={u.unitNumber ?? ""} placeholder={String(i + 1)} onChange={(e) => setUnit(i, { unitNumber: e.target.value })} />
                      </td>
                      <td className="px-2 py-2">
                        <Input className="h-8 w-16" type="number" value={u.floor ?? ""} onChange={(e) => setUnit(i, { floor: num(e.target.value) as number | null })} />
                      </td>
                      <td className="px-2 py-2">
                        <Input className="h-8 w-20" type="number" value={u.areaSqm ?? ""} onChange={(e) => setUnit(i, { areaSqm: num(e.target.value) })} />
                      </td>
                      <td className="px-2 py-2">
                        <Select value={u.unitType ?? "APARTMENT"} onValueChange={(v) => setUnit(i, { unitType: v as UnitTypeStr })}>
                          <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {(Object.keys(UNIT_TYPE_LABEL) as UnitTypeStr[]).map((t) => <SelectItem key={t} value={t}>{UNIT_TYPE_LABEL[t]}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className={`px-2 py-2 text-right tabular-nums ${missingArea ? "text-red-600" : "text-[var(--foreground)]"}`}>{mil.g.get(String(i)) ?? "—"}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-[var(--foreground)]">{mil.e ? (mil.e.get(String(i)) ?? (missingArea ? "—" : 0)) : "—"}</td>
                      <td className="px-2 py-2 text-right">
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-[var(--muted-foreground)] hover:text-red-600" onClick={() => removeUnit(i)} aria-label="Διαγραφή μονάδας">
                          <RiDeleteBinLine className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                <tr className="border-t-2 border-[var(--border)] font-medium">
                  <td className="px-2 py-2">Σύνολο</td>
                  <td className="px-2 py-2" />
                  <td className="px-2 py-2" />
                  <td className="px-2 py-2" />
                  <td className={`px-2 py-2 text-right tabular-nums ${gSumOk ? "text-emerald-600" : "text-red-600"}`}>{Math.round(mil.gSum)}</td>
                  <td className={`px-2 py-2 text-right tabular-nums ${!mil.e ? "text-[var(--muted-foreground)]" : eSumOk ? "text-emerald-600" : "text-red-600"}`}>{mil.e ? Math.round(mil.eSum) : "—"}</td>
                  <td className="px-2 py-2" />
                </tr>
              </tbody>
            </table>
          </div>

          <Button type="button" variant="outline" size="sm" className="mt-4 gap-1" onClick={addUnit}>
            <RiAddLine className="h-4 w-4" /> Μονάδα
          </Button>
        </section>

        {/* Footer / submit */}
        <div className="space-y-3">
          {err && (
            <Alert variant="destructive">
              <AlertDescription>{err}</AlertDescription>
            </Alert>
          )}
          <div className="flex justify-end">
            <Button onClick={create} disabled={!complete || pending} size="lg" className="w-full sm:w-auto">
              {pending ? "Δημιουργία…" : "Δημιουργία & συνέχεια στις λεπτομέρειες →"}
            </Button>
          </div>
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
    </>
  );
}
