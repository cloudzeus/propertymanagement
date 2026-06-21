# Πολλαπλά σετ χιλιοστών, συντελεστής ορόφου ανελκυστήρα & εξαιρέσεις δαπανών — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Υποστήριξη 3 σετ χιλιοστών (γενικά/ανελκυστήρα/θέρμανση) με συντελεστή ορόφου, per-cell auto-lock για τιμές κανονισμού, μέθοδο κατανομής ανά κατηγορία (default + override κανονισμού), εξαιρέσεις μονάδα×κατηγορία, και διαφανή ανάλυση στην εκτύπωση.

**Architecture:** Καθαρές συναρτήσεις υπολογισμού (`lib/millesimes.ts`, `lib/expenses/basis.ts`, `lib/expenses/allocation.ts`) που δοκιμάζονται απομονωμένα· τα server actions (`buildings.ts`, `building-expenses.ts`, νέα `building-millesimes.ts`) τις καλούν· UI στις παραμέτρους κτηρίου με 3 σημεία (πίνακας χιλιοστών, tab Κατανομή, matrix συμμετοχής). Ο κανονισμός/όροφος ζει σε προ-υπολογισμένα δεδομένα μονάδας/κτηρίου — η δαπάνη φέρει μόνο κατηγορία.

**Tech Stack:** Next.js 16.2 (server actions/components), Prisma 7 + PostgreSQL, Vitest, shadcn/ui, react-icons/ri.

**Spec:** [docs/superpowers/specs/2026-06-21-millesimes-sets-elevator-exemptions-design.md](../specs/2026-06-21-millesimes-sets-elevator-exemptions-design.md)

---

## File Structure

- **Modify** `prisma/schema.prisma` — enums `MillesimeSource`, `DistributionBasis`; `Unit` 3 σετ + sources; `Building` elevator params; `ExpenseCategory.defaultBasis`; `BuildingCategoryOverride.distributionBasis`; new `UnitCategoryExclusion`; `ExpenseAllocation.breakdownNote`.
- **Modify** `lib/millesimes.ts` + `lib/millesimes.test.ts` — generic weighted distribution + elevator/heating weight builders.
- **Create** `lib/expenses/basis.ts` + `lib/expenses/basis.test.ts` — resolve per-unit weight given a `DistributionBasis` and exclusions.
- **Modify** `lib/expenses/allocation.ts` + **create** `lib/expenses/allocation.test.ts` — consume explicit per-unit weights; emit breakdown metadata.
- **Modify** `app/actions/buildings.ts` — recalc all 3 sets respecting `MANUAL` source.
- **Create** `app/actions/building-millesimes.ts` — save grid cells (auto-lock), category-basis override, exclusion-matrix toggle.
- **Modify** `app/actions/building-expenses.ts` — wire basis + exclusions into create/update allocation; write `breakdownNote`.
- **Modify** `lib/koinochrista-doc.ts` + `app/actions/koinochrista.ts` — carry/print `breakdownNote`.
- **Create** UI components under `app/(dashboard)/super-admin/buildings/[id]/` — `MillesimeGrid.tsx`, `DistributionTab.tsx`, `ExclusionMatrix.tsx` (wired into the building page; exact wiring in Task 9).

---

## Task 1: Schema — enums, fields, new model, migration

**Files:**
- Modify: `prisma/schema.prisma` (Unit ~980-1013, Building ~590-640, ExpenseCategory ~843-856, BuildingCategoryOverride ~858-870, ExpenseAllocation ~893-913)

- [ ] **Step 1: Add the two enums** near the other enums (after the `DistributionBasis`-less file — place above `model Building`).

```prisma
enum MillesimeSource {
  AUTO
  MANUAL
}

enum DistributionBasis {
  GENERAL_MILLESIMES
  ELEVATOR_MILLESIMES
  HEATING_MILLESIMES
  EQUAL_PER_UNIT
  METERED_70_30
}
```

- [ ] **Step 2: Extend `Unit`** — add after the existing `millesimes` line (`prisma/schema.prisma:991`):

```prisma
  millesimesElevator    Float?
  millesimesHeating     Float?
  millesimesSource          MillesimeSource @default(AUTO)
  millesimesElevatorSource  MillesimeSource @default(AUTO)
  millesimesHeatingSource   MillesimeSource @default(AUTO)
  categoryExclusions    UnitCategoryExclusion[]
```

- [ ] **Step 3: Extend `Building`** — add inside `model Building` (near other scalar fields, e.g. after `units Unit[]` block is fine but keep scalars together; place before relations):

```prisma
  elevatorSurchargePerFloor  Float   @default(0.10)
  elevatorExemptGroundFloor  Boolean @default(true)
```

- [ ] **Step 4: Extend `ExpenseCategory`** — add after `utilityType`:

```prisma
  defaultBasis DistributionBasis @default(GENERAL_MILLESIMES)
```

- [ ] **Step 5: Extend `BuildingCategoryOverride`** — add after `ownerPct`:

```prisma
  distributionBasis DistributionBasis?
```

- [ ] **Step 6: Extend `ExpenseAllocation`** — add after `unitShare`:

```prisma
  breakdownNote String?
```

- [ ] **Step 7: Add new model** `UnitCategoryExclusion` (place after `BuildingCategoryOverride`, ~line 870):

```prisma
model UnitCategoryExclusion {
  id         String   @id @default(cuid())
  unitId     String
  unit       Unit     @relation(fields: [unitId], references: [id], onDelete: Cascade)
  categoryId String
  category   ExpenseCategory @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  createdAt  DateTime @default(now())
  @@unique([unitId, categoryId])
  @@index([unitId])
  @@index([categoryId])
}
```

- [ ] **Step 8: Add back-relation on `ExpenseCategory`** — add inside `model ExpenseCategory` next to `overrides`:

```prisma
  exclusions UnitCategoryExclusion[]
```

- [ ] **Step 9: Create the migration**

Run: `npx prisma migrate dev --name millesimes_sets_elevator_exemptions`
Expected: migration created and applied; `prisma generate` runs automatically.

- [ ] **Step 10: Verify the client compiles**

Run: `npx tsc --noEmit`
Expected: PASS (no type errors from the new fields).

- [ ] **Step 11: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(schema): millesime sets, elevator params, category basis & exclusions"
```

---

## Task 2: `lib/millesimes.ts` — generic weighted distribution + set builders

**Files:**
- Modify: `lib/millesimes.ts`
- Test: `lib/millesimes.test.ts`

- [ ] **Step 1: Write the failing tests** — append to `lib/millesimes.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { distributeWeights, elevatorWeight, type WeightInput } from "./millesimes";

describe("distributeWeights", () => {
  it("distributes 1000 by weight, remainder on largest", () => {
    const r = distributeWeights([
      { id: "a", weight: 100 },
      { id: "b", weight: 100 },
      { id: "c", weight: 100 },
    ]);
    expect(r.find((x) => x.id === "a")!.value! + r.find((x) => x.id === "b")!.value! + r.find((x) => x.id === "c")!.value!).toBe(1000);
  });

  it("zero/negative weights become null and are excluded", () => {
    const r = distributeWeights([
      { id: "a", weight: 0 },
      { id: "b", weight: 50 },
      { id: "c", weight: 50 },
    ]);
    expect(r.find((x) => x.id === "a")!.value).toBeNull();
    expect(r.find((x) => x.id === "b")!.value).toBe(500);
  });

  it("all-zero returns all null", () => {
    const r = distributeWeights([{ id: "a", weight: 0 }]);
    expect(r[0].value).toBeNull();
  });
});

describe("elevatorWeight", () => {
  it("ground floor excluded when exempt", () => {
    expect(elevatorWeight(80, 0, 0.1, true)).toBe(0);
  });
  it("higher floors weigh more", () => {
    expect(elevatorWeight(80, 2, 0.1, true)).toBeCloseTo(96); // 80 * (1 + 0.1*2)
  });
  it("ground floor counted when not exempt", () => {
    expect(elevatorWeight(80, 0, 0.1, false)).toBe(80);
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run lib/millesimes.test.ts`
Expected: FAIL ("distributeWeights is not a function").

- [ ] **Step 3: Implement** — append to `lib/millesimes.ts` (keep the existing `computeMillesimes` for backward-compat; it can later delegate, but do not change it now):

```ts
export type WeightInput = { id: string; weight: number };
export type WeightResult = { id: string; value: number | null };

/** Distribute exactly 1000 across positive weights; remainder on the largest
 *  weight. Zero/negative weights → null (excluded). All-zero → all null. */
export function distributeWeights(items: WeightInput[]): WeightResult[] {
  const positive = items.filter((i) => i.weight > 0);
  const total = positive.reduce((s, i) => s + i.weight, 0);
  if (total <= 0) return items.map((i) => ({ id: i.id, value: null }));

  const raw = new Map<string, number>();
  for (const i of positive) raw.set(i.id, round2((i.weight / total) * 1000));

  const assigned = [...raw.values()].reduce((s, v) => s + v, 0);
  const remainder = round2(1000 - assigned);
  if (remainder !== 0) {
    const largest = positive.reduce((a, b) => (b.weight > a.weight ? b : a));
    raw.set(largest.id, round2((raw.get(largest.id) as number) + remainder));
  }
  return items.map((i) => ({ id: i.id, value: raw.has(i.id) ? (raw.get(i.id) as number) : null }));
}

/** Elevator weight for a unit: area × (1 + surcharge × floor). Ground floor
 *  (floor 0) is 0 when exemptGround is true. Null area → 0. */
export function elevatorWeight(
  areaSqm: number | null,
  floor: number | null,
  surchargePerFloor: number,
  exemptGround: boolean,
): number {
  const area = areaSqm ?? 0;
  const fl = floor ?? 0;
  if (exemptGround && fl === 0) return 0;
  return area * (1 + surchargePerFloor * fl);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run lib/millesimes.test.ts`
Expected: PASS (all, including the pre-existing `computeMillesimes` tests).

- [ ] **Step 5: Commit**

```bash
git add lib/millesimes.ts lib/millesimes.test.ts
git commit -m "feat(millesimes): generic weight distribution + elevator weight"
```

---

## Task 3: `lib/expenses/basis.ts` — per-unit weights for a distribution basis

**Files:**
- Create: `lib/expenses/basis.ts`
- Test: `lib/expenses/basis.test.ts`

- [ ] **Step 1: Write the failing test** — create `lib/expenses/basis.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { resolveWeights, type BasisUnit } from "./basis";

const units: BasisUnit[] = [
  { unitId: "shop", millesimes: 240, millesimesElevator: 0, millesimesHeating: 0, excluded: false },
  { unitId: "a1", millesimes: 160, millesimesElevator: 176, millesimesHeating: 160, excluded: false },
  { unitId: "b1", millesimes: 120, millesimesElevator: 312, millesimesHeating: 340, excluded: false },
];

describe("resolveWeights", () => {
  it("GENERAL uses millesimes", () => {
    const w = resolveWeights("GENERAL_MILLESIMES", units, null);
    expect(w.get("shop")).toBe(240);
  });

  it("ELEVATOR uses elevator set", () => {
    const w = resolveWeights("ELEVATOR_MILLESIMES", units, null);
    expect(w.get("a1")).toBe(176);
  });

  it("EQUAL gives all participants weight 1", () => {
    const w = resolveWeights("EQUAL_PER_UNIT", units, null);
    expect(w.get("shop")).toBe(1);
    expect(w.get("b1")).toBe(1);
  });

  it("excluded units get weight 0 regardless of basis", () => {
    const w = resolveWeights("GENERAL_MILLESIMES",
      units.map((u) => (u.unitId === "shop" ? { ...u, excluded: true } : u)), null);
    expect(w.get("shop")).toBe(0);
    expect(w.get("a1")).toBe(160);
  });

  it("METERED_70_30 weights = 0.30 share of heating millesimes + 0.70 of meter readings", () => {
    const readings = new Map([["a1", 18], ["b1", 0], ["shop", 0]]);
    const w = resolveWeights("METERED_70_30", units, readings);
    // a1 carries all metered weight + its heating share → strictly greater than b1
    expect(w.get("a1")!).toBeGreaterThan(w.get("b1")!);
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run lib/expenses/basis.test.ts`
Expected: FAIL ("resolveWeights is not a function").

- [ ] **Step 3: Implement** — create `lib/expenses/basis.ts`:

```ts
import type { DistributionBasis } from "@prisma/client";

export type BasisUnit = {
  unitId: string;
  millesimes: number | null;
  millesimesElevator: number | null;
  millesimesHeating: number | null;
  excluded: boolean;
};

/** Produce a raw per-unit weight map for the given basis. Excluded units always
 *  weigh 0. Re-normalisation to 1000 happens later in computeAllocation by
 *  dividing by the sum of participating weights. `meterReadings` is required
 *  only for METERED_70_30 (unitId → consumption). */
export function resolveWeights(
  basis: DistributionBasis,
  units: BasisUnit[],
  meterReadings: Map<string, number> | null,
): Map<string, number> {
  const w = new Map<string, number>();

  if (basis === "EQUAL_PER_UNIT") {
    for (const u of units) w.set(u.unitId, u.excluded ? 0 : 1);
    return w;
  }

  if (basis === "METERED_70_30") {
    const readings = meterReadings ?? new Map();
    const participants = units.filter((u) => !u.excluded);
    const totalReading = participants.reduce((s, u) => s + (readings.get(u.unitId) ?? 0), 0);
    const totalHeating = participants.reduce((s, u) => s + (u.millesimesHeating ?? 0), 0);
    for (const u of units) {
      if (u.excluded) { w.set(u.unitId, 0); continue; }
      // Combine into a single comparable weight: 0.70 by metered fraction,
      // 0.30 by heating-millesime fraction. Falls back to pure heating if no
      // readings exist (totalReading === 0).
      const meterPart = totalReading > 0 ? (readings.get(u.unitId) ?? 0) / totalReading : 0;
      const heatPart = totalHeating > 0 ? (u.millesimesHeating ?? 0) / totalHeating : 0;
      const combined = totalReading > 0 ? 0.7 * meterPart + 0.3 * heatPart : heatPart;
      w.set(u.unitId, combined);
    }
    return w;
  }

  const pick = (u: BasisUnit) =>
    basis === "ELEVATOR_MILLESIMES" ? u.millesimesElevator
    : basis === "HEATING_MILLESIMES" ? u.millesimesHeating
    : u.millesimes;

  for (const u of units) w.set(u.unitId, u.excluded ? 0 : (pick(u) ?? 0));
  return w;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run lib/expenses/basis.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/expenses/basis.ts lib/expenses/basis.test.ts
git commit -m "feat(expenses): resolve per-unit weights by distribution basis"
```

---

## Task 4: `lib/expenses/allocation.ts` — explicit weights + breakdown metadata

**Files:**
- Modify: `lib/expenses/allocation.ts`
- Test: `lib/expenses/allocation.test.ts` (create)

- [ ] **Step 1: Write the failing test** — create `lib/expenses/allocation.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeAllocation, type AllocUnit } from "./allocation";

const u = (unitId: string, weight: number): AllocUnit => ({
  unitId, weight, ownerUserId: unitId + "-o", tenantUserId: null,
});

describe("computeAllocation (weights)", () => {
  it("splits total by weight; shares sum to total", () => {
    const rows = computeAllocation({ total: 100, tenantPct: 0, ownerPct: 100, units: [u("a", 600), u("b", 400)] });
    const sum = rows.reduce((s, r) => s + r.unitShare, 0);
    expect(sum).toBe(100);
    expect(rows.find((r) => r.unitId === "a")!.unitShare).toBe(60);
  });

  it("excluded (weight 0) unit gets 0; others re-normalise to full total", () => {
    const rows = computeAllocation({ total: 100, tenantPct: 0, ownerPct: 100, units: [u("shop", 0), u("a", 100), u("b", 100)] });
    expect(rows.find((r) => r.unitId === "shop")!.unitShare).toBe(0);
    expect(rows.reduce((s, r) => s + r.unitShare, 0)).toBe(100);
  });

  it("tenant split applies", () => {
    const rows = computeAllocation({ total: 100, tenantPct: 25, ownerPct: 75, units: [u("a", 100)] });
    expect(rows[0].tenantAmount).toBe(25);
    expect(rows[0].ownerAmount).toBe(75);
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run lib/expenses/allocation.test.ts`
Expected: FAIL (current `AllocUnit` has `millesimes`, not `weight`).

- [ ] **Step 3: Replace the implementation** — rewrite `lib/expenses/allocation.ts` to use an explicit `weight` field (the caller now supplies the basis-resolved weight). Keep `resolveSplit` unchanged.

```ts
export type AllocUnit = {
  unitId: string;
  weight: number;
  ownerUserId: string | null;
  tenantUserId: string | null;
};

export type AllocRow = {
  unitId: string;
  unitShare: number;
  tenantUserId: string | null;
  tenantAmount: number;
  ownerUserId: string | null;
  ownerAmount: number;
  missingWeight: boolean;
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function computeAllocation(args: {
  total: number; tenantPct: number; ownerPct: number; units: AllocUnit[];
}): AllocRow[] {
  const { total, tenantPct, units } = args;
  const weighted = units.filter((u) => u.weight > 0);
  const weight = weighted.reduce((s, u) => s + u.weight, 0);
  const lastWeightedId = weighted.length ? weighted[weighted.length - 1].unitId : null;

  let running = 0;
  return units.map((u) => {
    const hasWeight = u.weight > 0;
    let share = 0;
    if (weight > 0 && hasWeight) {
      if (u.unitId === lastWeightedId) {
        share = round2(total - running);
      } else {
        share = round2((total * u.weight) / weight);
        running += share;
      }
    }
    const tenantAmount = round2((share * tenantPct) / 100);
    const ownerAmount = round2(share - tenantAmount);
    return { unitId: u.unitId, unitShare: share, tenantUserId: u.tenantUserId, tenantAmount, ownerUserId: u.ownerUserId, ownerAmount, missingWeight: !hasWeight };
  });
}

export function resolveSplit(
  category: { defaultTenantPct: number; defaultOwnerPct: number },
  override: { tenantPct: number; ownerPct: number } | null,
): { tenantPct: number; ownerPct: number } {
  if (override) return { tenantPct: override.tenantPct, ownerPct: override.ownerPct };
  return { tenantPct: category.defaultTenantPct, ownerPct: category.defaultOwnerPct };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run lib/expenses/allocation.test.ts`
Expected: PASS.

- [ ] **Step 5: Fix renamed-field consumers** — `AllocRow.missingMillesimes` became `missingWeight` and `AllocUnit.millesimes` became `weight`.

Run: `grep -rn "missingMillesimes" app components lib`
For each hit (e.g. an allocation-preview component), rename to `missingWeight`. Re-run `npx tsc --noEmit` until clean.

- [ ] **Step 6: Commit**

```bash
git add lib/expenses/allocation.ts lib/expenses/allocation.test.ts app components
git commit -m "refactor(allocation): use explicit per-unit weight, support exclusions"
```

---

## Task 5: Wire basis + exclusions into expense allocation (`building-expenses.ts`)

**Files:**
- Modify: `app/actions/building-expenses.ts` (`loadAllocUnits` ~109-120; `createBuildingExpense` ~145-191; `updateBuildingExpense` ~207-257)

- [ ] **Step 1: Replace `loadAllocUnits`** to load the 3 sets, floor, exclusions, building elevator params, and the category basis — returning everything the allocation needs. Replace lines 107-120:

```ts
import { resolveWeights, type BasisUnit } from "@/lib/expenses/basis";
import type { DistributionBasis } from "@prisma/client";

type LoadedUnit = BasisUnit & { ownerUserId: string | null; tenantUserId: string | null; floor: number | null };

async function loadAllocContext(buildingId: string, categoryId: string | null) {
  const [units, building, category, overrides, exclusions] = await Promise.all([
    db.unit.findMany({
      where: { buildingId },
      select: {
        id: true, floor: true, millesimes: true, millesimesElevator: true, millesimesHeating: true,
        ownerId: true, residentId: true,
        occupancies: { where: { endDate: null }, select: { userId: true, role: true } },
      },
    }),
    db.building.findUnique({ where: { id: buildingId }, select: { elevatorSurchargePerFloor: true, elevatorExemptGroundFloor: true } }),
    categoryId ? db.expenseCategory.findUnique({ where: { id: categoryId }, select: { defaultBasis: true } }) : null,
    categoryId ? db.buildingCategoryOverride.findUnique({ where: { buildingId_categoryId: { buildingId, categoryId } }, select: { distributionBasis: true } }) : null,
    categoryId ? db.unitCategoryExclusion.findMany({ where: { categoryId, unit: { buildingId } }, select: { unitId: true } }) : [],
  ]);

  const excludedIds = new Set((exclusions ?? []).map((e) => e.unitId));
  const loaded: LoadedUnit[] = units.map((u) => {
    const owner = u.occupancies.find((o) => o.role === "OWNER")?.userId ?? u.ownerId ?? null;
    const tenant = u.occupancies.find((o) => o.role === "RESIDENT")?.userId ?? u.residentId ?? null;
    return {
      unitId: u.id, floor: u.floor,
      millesimes: u.millesimes, millesimesElevator: u.millesimesElevator, millesimesHeating: u.millesimesHeating,
      excluded: excludedIds.has(u.id), ownerUserId: owner, tenantUserId: tenant,
    };
  });

  const basis: DistributionBasis = overrides?.distributionBasis ?? category?.defaultBasis ?? "GENERAL_MILLESIMES";
  return { loaded, basis, excludedIds };
}
```

- [ ] **Step 2: Add a helper** that builds `AllocUnit[]` + a per-expense breakdown note. Add below `loadAllocContext`:

```ts
const BASIS_LABEL: Record<DistributionBasis, string> = {
  GENERAL_MILLESIMES: "γενικά χιλιοστά",
  ELEVATOR_MILLESIMES: "χιλιοστά ανελκυστήρα",
  HEATING_MILLESIMES: "χιλιοστά θέρμανσης",
  EQUAL_PER_UNIT: "ισόποσα ανά μονάδα",
  METERED_70_30: "70% μέτρηση + 30% χιλιοστά",
};

function buildAllocUnits(loaded: LoadedUnit[], basis: DistributionBasis, meterReadings: Map<string, number> | null) {
  const weights = resolveWeights(basis, loaded, meterReadings);
  const allocUnits = loaded.map((u) => ({
    unitId: u.unitId, weight: weights.get(u.unitId) ?? 0,
    ownerUserId: u.ownerUserId, tenantUserId: u.tenantUserId,
  }));
  const participants = loaded.filter((u) => !u.excluded).length;
  const note = `Μέθοδος: ${BASIS_LABEL[basis]} · Συμμετέχουν ${participants}/${loaded.length} μονάδες`;
  return { allocUnits, note };
}
```

- [ ] **Step 3: Update `previewExpenseAllocation`** (lines 122-127) — it no longer takes pct-only; pass `categoryId`:

```ts
export async function previewExpenseAllocation(buildingId: string, args: { total: number; tenantPct: number; ownerPct: number; categoryId: string | null }) {
  await requireBuildingAccess(buildingId);
  assertSplit(args.tenantPct, args.ownerPct);
  const { loaded, basis } = await loadAllocContext(buildingId, args.categoryId);
  const { allocUnits } = buildAllocUnits(loaded, basis, null);
  return computeAllocation({ total: args.total, tenantPct: args.tenantPct, ownerPct: args.ownerPct, units: allocUnits });
}
```

- [ ] **Step 4: Update `createBuildingExpense`** — replace lines 148-149 and the `createMany` block (179-183). After computing `rows`, persist `breakdownNote`. Use the meter reading from `input.meter.consumption` keyed per building only if METERED (single OCR meter is building-level, so METERED falls back to heating millesimes — pass `null`):

```ts
  const { loaded, basis } = await loadAllocContext(buildingId, input.categoryId);
  const { allocUnits, note } = buildAllocUnits(loaded, basis, null);
  const rows = computeAllocation({ total: input.totalAmount, tenantPct: input.tenantPct, ownerPct: input.ownerPct, units: allocUnits });
```

and the createMany (line 180):

```ts
      await tx.expenseAllocation.createMany({
        data: rows.map((r) => ({ expenseId: exp.id, unitId: r.unitId, unitShare: r.unitShare, breakdownNote: note, tenantUserId: r.tenantUserId, tenantAmount: r.tenantAmount, ownerUserId: r.ownerUserId, ownerAmount: r.ownerAmount })),
      });
```

- [ ] **Step 5: Update `updateBuildingExpense`** — replace lines 214-215 and the createMany (249-251) identically:

```ts
  const { loaded, basis } = await loadAllocContext(current.buildingId, input.categoryId);
  const { allocUnits, note } = buildAllocUnits(loaded, basis, null);
  const rows = computeAllocation({ total: input.totalAmount, tenantPct: input.tenantPct, ownerPct: input.ownerPct, units: allocUnits });
```

```ts
      await tx.expenseAllocation.createMany({
        data: rows.map((r) => ({ expenseId: id, unitId: r.unitId, unitShare: r.unitShare, breakdownNote: note, tenantUserId: r.tenantUserId, tenantAmount: r.tenantAmount, ownerUserId: r.ownerUserId, ownerAmount: r.ownerAmount })),
      });
```

- [ ] **Step 6: Remove the now-unused `loadAllocUnits` and its `UnitForAlloc` type** (old lines 107-120) and the old `import { computeAllocation, type AllocUnit }` — keep `computeAllocation` import, drop `AllocUnit` if unused. Search the file for remaining `AllocUnit`/`millesimes` references and fix.

Run: `grep -n "loadAllocUnits\|UnitForAlloc\|\.millesimes" app/actions/building-expenses.ts`
Expected: no matches.

- [ ] **Step 7: Update the caller of `previewExpenseAllocation`** — find the client component passing args and add `categoryId`.

Run: `grep -rn "previewExpenseAllocation" "app/(dashboard)" components`
Then add `categoryId` to the args object at each call site (pass the currently-selected category id, or `null`).

- [ ] **Step 8: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add app/actions/building-expenses.ts "app/(dashboard)" components
git commit -m "feat(expenses): allocate by category basis with exclusions + breakdown note"
```

---

## Task 6: Recalculate all 3 millesime sets respecting MANUAL source (`buildings.ts`)

**Files:**
- Modify: `app/actions/buildings.ts` (`recalculateMillesimes` ~183-209)

- [ ] **Step 1: Rewrite `recalculateMillesimes`** to compute general + elevator + heating, skipping `MANUAL` cells. Replace the function body:

```ts
import { distributeWeights, elevatorWeight, type WeightInput } from "@/lib/millesimes";

export async function recalculateMillesimes(buildingId: string) {
  await requireBuildingAccess(buildingId);
  const building = await db.building.findUnique({
    where: { id: buildingId },
    select: {
      elevatorSurchargePerFloor: true, elevatorExemptGroundFloor: true,
      units: { select: { id: true, areaSqm: true, floor: true, millesimesSource: true, millesimesElevatorSource: true, millesimesHeatingSource: true } },
    },
  });
  if (!building) throw new Error("Δεν βρέθηκε κτήριο.");
  const units = building.units;
  if (!units.some((u) => u.areaSqm != null && u.areaSqm > 0)) {
    return { error: "Καμία μονάδα δεν έχει τετραγωνικά — συμπληρώστε τ.μ. πρώτα." };
  }

  // Compute each set from AUTO cells only; MANUAL cells keep their value.
  const general = distributeWeights(units.map((u) => ({ id: u.id, weight: u.areaSqm ?? 0 })));
  const elevator = distributeWeights(units.map((u): WeightInput => ({
    id: u.id, weight: elevatorWeight(u.areaSqm ?? 0, u.floor, building.elevatorSurchargePerFloor, building.elevatorExemptGroundFloor),
  })));
  const heating = distributeWeights(units.map((u) => ({ id: u.id, weight: u.areaSqm ?? 0 })));
  const byId = (arr: { id: string; value: number | null }[]) => new Map(arr.map((r) => [r.id, r.value]));
  const g = byId(general), e = byId(elevator), h = byId(heating);

  let updated = 0;
  await db.$transaction(
    units.map((u) => {
      const data: Record<string, number | null> = {};
      if (u.millesimesSource === "AUTO") data.millesimes = g.get(u.id) ?? null;
      if (u.millesimesElevatorSource === "AUTO") data.millesimesElevator = e.get(u.id) ?? null;
      if (u.millesimesHeatingSource === "AUTO") data.millesimesHeating = h.get(u.id) ?? null;
      updated++;
      return db.unit.update({ where: { id: u.id }, data });
    }),
  );
  revalidatePath(`/super-admin/buildings/${buildingId}`);
  return { updated };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/actions/buildings.ts
git commit -m "feat(buildings): recalc 3 millesime sets, skip MANUAL cells"
```

---

## Task 7: Server actions for grid edit, category basis & exclusions (`building-millesimes.ts`)

**Files:**
- Create: `app/actions/building-millesimes.ts`

- [ ] **Step 1: Create the file** with three actions. Mirror the auth pattern from `buildings.ts` (`requireBuildingAccess`).

```ts
"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireBuildingAccess } from "@/app/actions/buildings";
import type { DistributionBasis } from "@prisma/client";

type SetKey = "general" | "elevator" | "heating";

/** Save one millesime cell. A non-null value locks it (MANUAL); passing
 *  `reset: true` returns the cell to AUTO and clears the manual value. */
export async function saveMillesimeCell(
  buildingId: string,
  unitId: string,
  set: SetKey,
  value: number | null,
  reset = false,
) {
  await requireBuildingAccess(buildingId);
  const field = set === "elevator" ? "millesimesElevator" : set === "heating" ? "millesimesHeating" : "millesimes";
  const sourceField = set === "elevator" ? "millesimesElevatorSource" : set === "heating" ? "millesimesHeatingSource" : "millesimesSource";
  const data = reset
    ? { [sourceField]: "AUTO" } // value will be recomputed by recalculateMillesimes
    : { [field]: value, [sourceField]: "MANUAL" };
  await db.unit.update({ where: { id: unitId }, data });
  revalidatePath(`/super-admin/buildings/${buildingId}`);
  return { ok: true };
}

/** Set (or clear) the building's distribution-method override for a category.
 *  Pass `basis: null` to remove the override and fall back to the category default. */
export async function setCategoryBasis(buildingId: string, categoryId: string, basis: DistributionBasis | null) {
  await requireBuildingAccess(buildingId);
  if (basis === null) {
    await db.buildingCategoryOverride.deleteMany({ where: { buildingId, categoryId } });
  } else {
    const existing = await db.buildingCategoryOverride.findUnique({ where: { buildingId_categoryId: { buildingId, categoryId } } });
    if (existing) {
      await db.buildingCategoryOverride.update({ where: { buildingId_categoryId: { buildingId, categoryId } }, data: { distributionBasis: basis } });
    } else {
      // tenantPct/ownerPct are required on the row — seed from the category defaults.
      const cat = await db.expenseCategory.findUnique({ where: { id: categoryId }, select: { defaultTenantPct: true, defaultOwnerPct: true } });
      await db.buildingCategoryOverride.create({ data: { buildingId, categoryId, distributionBasis: basis, tenantPct: cat?.defaultTenantPct ?? 0, ownerPct: cat?.defaultOwnerPct ?? 100 } });
    }
  }
  revalidatePath(`/super-admin/buildings/${buildingId}`);
  return { ok: true };
}

/** Toggle a unit×category exclusion. `excluded: true` creates the row (unit does
 *  NOT pay); false deletes it (unit pays — the default). */
export async function setUnitCategoryExclusion(buildingId: string, unitId: string, categoryId: string, excluded: boolean) {
  await requireBuildingAccess(buildingId);
  if (excluded) {
    await db.unitCategoryExclusion.upsert({
      where: { unitId_categoryId: { unitId, categoryId } },
      create: { unitId, categoryId },
      update: {},
    });
  } else {
    await db.unitCategoryExclusion.deleteMany({ where: { unitId, categoryId } });
  }
  revalidatePath(`/super-admin/buildings/${buildingId}`);
  return { ok: true };
}

/** Save building-level elevator parameters. */
export async function saveElevatorParams(buildingId: string, surchargePerFloor: number, exemptGroundFloor: boolean) {
  await requireBuildingAccess(buildingId);
  await db.building.update({ where: { id: buildingId }, data: { elevatorSurchargePerFloor: surchargePerFloor, elevatorExemptGroundFloor: exemptGroundFloor } });
  revalidatePath(`/super-admin/buildings/${buildingId}`);
  return { ok: true };
}
```

- [ ] **Step 2: Confirm `requireBuildingAccess` is exported from `buildings.ts`**

Run: `grep -n "requireBuildingAccess" app/actions/buildings.ts`
Expected: an `export` (function or const). If it is NOT exported, add `export` to its declaration and commit that one-line change with this task.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/actions/building-millesimes.ts app/actions/buildings.ts
git commit -m "feat(buildings): actions for millesime cells, category basis, exclusions"
```

---

## Task 8: Printout — carry the breakdown note into the document

**Files:**
- Modify: `lib/koinochrista-doc.ts` (`KoinoLine` type ~8-16; row render ~45-50)
- Modify: `app/actions/koinochrista.ts` (`aggregateByPerson` ~90-106; both `p.lines.push` calls; the `base` object ~91)

- [ ] **Step 1: Add `note` to `KoinoLine`** in `lib/koinochrista-doc.ts` (after `amount`):

```ts
  note?: string | null;
```

- [ ] **Step 2: Render the note** — in the row template (around line 45-50), add a second line under the category cell. Replace the category `<td>`:

```ts
        <td>${esc(l.category)}${l.note ? `<div style="font-size:11px;color:#666">${esc(l.note)}</div>` : ""}</td>
```

- [ ] **Step 3: Load `breakdownNote`** in `aggregateByPerson` — the `allocations` include already returns rows; add `breakdownNote` to what we read. In `app/actions/koinochrista.ts`, the `allocations: { include: { unit: ... } }` already returns all scalar fields, so `a.breakdownNote` is available. Add it to the pushed line. Update both `p.lines.push({ ...base, role: ... })` calls (lines 96 and 102) to include `note: a.breakdownNote`:

```ts
        p.lines.push({ ...base, role: "OWNER", amount: num(a.ownerAmount), paid: a.ownerPaid, note: a.breakdownNote });
```

```ts
        p.lines.push({ ...base, role: "TENANT", amount: num(a.tenantAmount), paid: a.tenantPaid, note: a.breakdownNote });
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/koinochrista-doc.ts app/actions/koinochrista.ts
git commit -m "feat(koinochrista): print per-expense distribution breakdown"
```

---

## Task 9: UI — millesime grid, distribution tab, exclusion matrix

> These are client components rendered inside the building detail page
> `app/(dashboard)/super-admin/buildings/[id]/`. Follow the existing DataTable /
> shadcn patterns in that folder. Before writing, read one sibling client
> component (e.g. an existing units or expenses panel under `[id]/`) to match the
> page's data-loading and styling conventions.

**Files:**
- Create: `app/(dashboard)/super-admin/buildings/[id]/MillesimeGrid.tsx`
- Create: `app/(dashboard)/super-admin/buildings/[id]/DistributionTab.tsx`
- Create: `app/(dashboard)/super-admin/buildings/[id]/ExclusionMatrix.tsx`
- Modify: the building detail page/tab host to mount the three components.

- [ ] **Step 1: Read a sibling component** to learn the conventions.

Run: `ls "app/(dashboard)/super-admin/buildings/[id]"`
Then read the page file and one existing panel to copy the data-fetch + tab pattern.

- [ ] **Step 2: `MillesimeGrid.tsx`** — props: `buildingId`, `units` (`{id, unitNumber, floor, areaSqm, millesimes, millesimesElevator, millesimesHeating, ...Source}`), `elevatorSurchargePerFloor`, `elevatorExemptGroundFloor`. Render the table from the approved mockup:
  - Header row with an editable «επιβάρυνση/όροφο» number input and an «εξαίρεση ισογείου» checkbox → on change call `saveElevatorParams` then `recalculateMillesimes`, `router.refresh()`.
  - One row per unit, three editable cells (Γενικά/Ανελκ./Θέρμ.). On blur with a changed value → `saveMillesimeCell(buildingId, unitId, set, value)` (locks to MANUAL); show 🔒 + amber when `*Source === "MANUAL"`.
  - A per-cell «↺» reset button shown on MANUAL cells → `saveMillesimeCell(..., null, true)` then `recalculateMillesimes`.
  - Live per-column totals computed client-side; show ✓ (green) when `=== 1000` else the value in red.
  - Footer buttons: «Επανυπολογισμός αυτομάτων» → `recalculateMillesimes`; «Επαναφορά κλειδωμένων» → reset every MANUAL cell then recalc.
  - Use `RiCalculatorLine`, `RiLockLine`, `RiRefreshLine` from `react-icons/ri`.

- [ ] **Step 3: `DistributionTab.tsx`** — props: `buildingId`, `categories` (`{id, name, defaultBasis}`), `overrides` (`{categoryId, distributionBasis}[]`). Render the table: κατηγορία | default (read-only label) | μέθοδος (a `<Select>` of the 5 `DistributionBasis` values) | ένδειξη. On change → `setCategoryBasis(buildingId, categoryId, value)` (`value === defaultBasis` may pass the basis; choosing the explicit «default» option passes `null`). Amber «κανονισμός» chip when an override exists and differs from default; «επαναφορά σε default» link → `setCategoryBasis(..., null)`. Reuse the `BASIS_LABEL` strings (duplicate a small label map locally — keep client/server label text identical).

- [ ] **Step 4: `ExclusionMatrix.tsx`** — props: `buildingId`, `units` (`{id, unitNumber, unitType}`), `categories` (`{id, name}`), `exclusions` (`{unitId, categoryId}[]`). Render a checkbox grid (rows = units, cols = categories), checked = participates (i.e. NOT in exclusions). On toggle → `setUnitCategoryExclusion(buildingId, unitId, categoryId, !checked)` then `router.refresh()`. Add a per-column bulk action «εξαίρεσε όλα τα καταστήματα» that loops units where `unitType` is a shop type and calls the action for each.

- [ ] **Step 5: Mount the three components** in the building detail page under a «Χιλιοστά & Κατανομή» area/tab. Fetch the needed data in the server component (units with the new fields, categories with `defaultBasis`, `buildingCategoryOverride` rows, `unitCategoryExclusion` rows, building elevator params) and pass as props.

- [ ] **Step 6: Manual verification** — run the app and confirm the flow.

Run: `npm run dev`
Then, for a building with units that have τ.μ. and floors:
  - Open Χιλιοστά & Κατανομή → press «Επανυπολογισμός αυτομάτων» → all three columns sum to 1000,00 (✓), ground-floor elevator cell is 0.
  - Edit a Γενικά cell → it shows 🔒 amber; re-run recalc → that cell keeps its manual value, others adjust.
  - Distribution tab → set «Νερό» to «Ισόποσα/μονάδα» → amber chip appears.
  - Exclusion matrix → untick a shop from «Ανελκυστήρας».
  - Create an elevator expense for that month → confirm the shop's allocation is 0 and the others sum to the full amount.

- [ ] **Step 7: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add "app/(dashboard)/super-admin/buildings/[id]"
git commit -m "feat(ui): millesime grid, distribution tab, exclusion matrix"
```

---

## Task 10: Seed default `defaultBasis` per category & full-suite check

**Files:**
- Modify: the expense-category seed (find it first)

- [ ] **Step 1: Locate where ExpenseCategory rows are created/seeded**

Run: `grep -rln "expenseCategory.create\|expenseCategory.upsert\|ExpenseCategory" prisma app/actions/expense-categories.ts`

- [ ] **Step 2: Set sensible `defaultBasis`** for known category codes in the seed/creator: elevator → `ELEVATOR_MILLESIMES`, heating → `HEATING_MILLESIMES` (or `METERED_70_30` if metered), everything else stays `GENERAL_MILLESIMES` (the schema default). If categories are user-created via `expense-categories.ts`, add a `defaultBasis` field to that create/update form + action instead, defaulting to `GENERAL_MILLESIMES`.

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: PASS (all millesimes/basis/allocation suites green).

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(expenses): default distribution basis per category"
```

---

## Notes for the implementer

- **Re-normalisation is implicit:** `computeAllocation` divides each unit's share by the sum of *participating* weights, so excluded units (weight 0) automatically shift their share onto the rest — no separate renormalise step needed.
- **METERED at building level:** the current OCR meter is a single building-level reading, so METERED_70_30 falls back to heating millesimes (pass `null` for `meterReadings`). Per-unit meter readings are a future enhancement — do not build them here.
- **Backward-compat:** the old `computeMillesimes(units)` stays for the existing autocalc modal; new code uses `distributeWeights`. Do not delete `computeMillesimes` in this plan.
- **`ISSUED` expenses are immutable** — exclusion/basis changes only affect future allocations, matching the existing lock in `updateBuildingExpense`.
