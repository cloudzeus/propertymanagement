/**
 * Pure rules of the «Χιλιοστά βήμα-βήμα» wizard: preview of the three sets
 * from a plan (auto-by-law or manual), the 1000‰ sum check, and the example
 * («how a 1.000 € expense is split») — all via the libs the server uses.
 */
import { distributeWeights, elevatorWeight } from "@/lib/millesimes";
import { computeAllocation } from "@/lib/expenses/allocation";

export type ManualCell = { unitId: string; value: number | null };
export type HeatingBasis = "HEATING_MILLESIMES" | "METERED_70_30" | "EQUAL_PER_UNIT" | "NONE";

export type MillesimesPlan = {
  general: "AUTO" | ManualCell[];
  elevator: { enabled: boolean; surchargePerFloor: number; exemptGroundFloor: boolean; manual: ManualCell[] | null };
  heating: { basis: HeatingBasis; manual: ManualCell[] | null };
};

export type PlanUnit = { id: string; unitNumber: string; areaSqm: number | null; floor: number | null };
export type PreviewRow = { unitId: string; unitNumber: string; general: number | null; elevator: number | null; heating: number | null };
export type MillesimesPreview = { rows: PreviewRow[]; totals: { general: number; elevator: number; heating: number }; missingArea: string[] };

const r2 = (n: number) => Math.round(n * 100) / 100;
const fmtGr = (n: number) => n.toLocaleString("el-GR", { maximumFractionDigits: 2 });

function manualMap(cells: ManualCell[]): Map<string, number | null> {
  return new Map(cells.map((c) => [c.unitId, c.value]));
}

/** General set: AUTO = area share; manual = as given. */
export function generalSet(units: PlanUnit[], plan: MillesimesPlan): Map<string, number | null> {
  if (plan.general === "AUTO") {
    return new Map(distributeWeights(units.map((u) => ({ id: u.id, weight: u.areaSqm ?? 0 }))).map((r) => [r.id, r.value]));
  }
  const m = manualMap(plan.general);
  return new Map(units.map((u) => [u.id, m.get(u.id) ?? null]));
}

/** Elevator set: null everywhere when disabled; manual as given; else area × (1 + surcharge × floor), ground floor 0 when exempt. */
export function elevatorSet(units: PlanUnit[], plan: MillesimesPlan): Map<string, number | null> {
  if (!plan.elevator.enabled) return new Map(units.map((u) => [u.id, null]));
  if (plan.elevator.manual) { const m = manualMap(plan.elevator.manual); return new Map(units.map((u) => [u.id, m.get(u.id) ?? null])); }
  const dist = distributeWeights(units.map((u) => ({ id: u.id, weight: elevatorWeight(u.areaSqm ?? 0, u.floor, plan.elevator.surchargePerFloor, plan.elevator.exemptGroundFloor) })));
  const byId = new Map(dist.map((r) => [r.id, r.value]));
  // a unit with area but zero weight (exempt ground floor) gets a real 0; no area → null
  return new Map(units.map((u) => [u.id, byId.get(u.id) ?? (u.areaSqm != null && u.areaSqm > 0 ? 0 : null)]));
}

/** Heating set: NONE → null; manual as given; else area share (METERED_70_30 and EQUAL_PER_UNIT still keep area-based millesimes as the 30% / fallback part). */
export function heatingSet(units: PlanUnit[], plan: MillesimesPlan): Map<string, number | null> {
  if (plan.heating.basis === "NONE") return new Map(units.map((u) => [u.id, null]));
  if (plan.heating.manual) { const m = manualMap(plan.heating.manual); return new Map(units.map((u) => [u.id, m.get(u.id) ?? null])); }
  return new Map(distributeWeights(units.map((u) => ({ id: u.id, weight: u.areaSqm ?? 0 }))).map((r) => [r.id, r.value]));
}

export function previewMillesimes(units: PlanUnit[], plan: MillesimesPlan): MillesimesPreview {
  const g = generalSet(units, plan), e = elevatorSet(units, plan), h = heatingSet(units, plan);
  const rows = units.map((u) => ({ unitId: u.id, unitNumber: u.unitNumber, general: g.get(u.id) ?? null, elevator: e.get(u.id) ?? null, heating: h.get(u.id) ?? null }));
  const sum = (k: "general" | "elevator" | "heating") => r2(rows.reduce((s, r) => s + (r[k] ?? 0), 0));
  return { rows, totals: { general: sum("general"), elevator: sum("elevator"), heating: sum("heating") }, missingArea: units.filter((u) => !(u.areaSqm != null && u.areaSqm > 0)).map((u) => u.unitNumber) };
}

/** null when the manual values sum to 1000 (±0.01); otherwise «Λείπουν 12,5‰ (σύνολο 987,5‰)» / «Περισσεύουν 3‰ (σύνολο 1.003‰)». */
export function manualSumError(values: { value: number | null }[]): string | null {
  const total = r2(values.reduce((s, v) => s + (v.value ?? 0), 0));
  const diff = r2(1000 - total);
  if (Math.abs(diff) < 0.01) return null;
  return diff > 0 ? `Λείπουν ${fmtGr(diff)}‰ (σύνολο ${fmtGr(total)}‰)` : `Περισσεύουν ${fmtGr(-diff)}‰ (σύνολο ${fmtGr(total)}‰)`;
}

export type ExampleExpense = { label: string; amount: number; set: "general" | "elevator" | "heating" };
export const DEFAULT_EXAMPLE_EXPENSES: ExampleExpense[] = [
  { label: "Καθαρισμός", amount: 1000, set: "general" },
  { label: "Συντήρηση ανελκυστήρα", amount: 600, set: "elevator" },
  { label: "Πετρέλαιο θέρμανσης", amount: 2000, set: "heating" },
];

export const LEGAL_BASIS = {
  general: "Ν.3741/1929, ΑΚ 1002/1117 — αναλογικά με τα τετραγωνικά",
  elevator: "ΚΥΑ 20.8.1997 — τετραγωνικά × (1 + προσαύξηση × όροφος), ισόγειο συνήθως εξαιρείται",
  heating: "Ν.1512/1985 — αναλογικά με τον όγκο/τετραγωνικά· με ωρομετρητές ΠΔ 27.9.1985 (70% κατανάλωση / 30% χιλιοστά)",
} as const;

export type MillesimesExample = {
  expenses: ExampleExpense[];
  /** amounts[i] = share of expenses[i]; null when that set does not exist (no elevator / individual heating) */
  perUnit: { unitId: string; unitNumber: string; amounts: (number | null)[] }[];
  legal: typeof LEGAL_BASIS;
  missingArea: string[];
};

/** How the example expenses would be split with this plan — same computeAllocation the κοινόχρηστα use. */
export function exampleForMillesimes(units: PlanUnit[], plan: MillesimesPlan, expenses: ExampleExpense[] = DEFAULT_EXAMPLE_EXPENSES): MillesimesExample {
  const preview = previewMillesimes(units, plan);
  const setExists = { general: true, elevator: plan.elevator.enabled, heating: plan.heating.basis !== "NONE" };
  const perExpense = expenses.map((e) => {
    if (!setExists[e.set]) return null;
    const rows = computeAllocation({ total: e.amount, tenantPct: 0, ownerPct: 100, units: preview.rows.map((r) => ({ unitId: r.unitId, weight: r[e.set] ?? 0, ownerUserId: null, tenantUserId: null })) });
    return new Map(rows.map((r) => [r.unitId, r.unitShare]));
  });
  return {
    expenses,
    perUnit: preview.rows.map((r) => ({ unitId: r.unitId, unitNumber: r.unitNumber, amounts: perExpense.map((m) => (m ? (m.get(r.unitId) ?? 0) : null)) })),
    legal: LEGAL_BASIS,
    missingArea: preview.missingArea,
  };
}
