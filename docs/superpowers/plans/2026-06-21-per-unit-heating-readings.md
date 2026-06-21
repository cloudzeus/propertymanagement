# Per-unit Heating Readings (full METERED_70_30) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let managers enter per-unit heating consumption readings per month so `METERED_70_30` heating expenses distribute 70% by real consumption + 30% by heating millesimes, with a transparent printed breakdown.

**Architecture:** A new `UnitHeatingReading` table (per unit, per YYYY-MM) feeds a `Map<unitId, consumption>` into the existing `resolveWeights("METERED_70_30", …)` — no change to the distribution math. A pure lib computes consumption; server actions manage readings (auto-filling "previous" from the prior month); a client panel (shown only for buildings that use metered heating) captures readings; the per-expense `breakdownNote` gains the consumption summary.

**Tech Stack:** Next.js 16.2 (server actions/components), Prisma 7 + PostgreSQL, Vitest, shadcn/ui, react-icons/ri.

**Spec:** [docs/superpowers/specs/2026-06-21-per-unit-heating-readings-design.md](../specs/2026-06-21-per-unit-heating-readings-design.md)

**Project conventions (critical):** Prisma enums import from `@/lib/prisma/enums` (NOT `@prisma/client`). DB client: `import { db } from "@/lib/db"`. Do NOT run `prisma migrate dev` — use `prisma migrate diff` + `prisma migrate deploy` (see Task 1). Enum/string comparisons like `=== "METERED_70_30"` are valid against the generated field types.

---

## File Structure

- **Modify** `prisma/schema.prisma` — model `UnitHeatingReading`; `Building.heatingMeterUnit`; back-relations on `Unit`/`Building`.
- **Create** `lib/heating-readings.ts` + `lib/heating-readings.test.ts` — `computeConsumption`, `toConsumptionMap`.
- **Modify** `app/actions/building-expenses.ts` — `loadAllocContext` takes `month`, loads readings for METERED, passes the map + heating-unit label; `buildAllocUnits` enriches the note; update callers + `previewExpenseAllocation`.
- **Modify** `components/buildings/ExpenseReviewForm.tsx` — pass `month` to `previewExpenseAllocation`.
- **Create** `app/actions/heating-readings.ts` — `listHeatingReadings`, `saveHeatingReading`, `bulkSaveHeatingReadings`, `saveHeatingMeterUnit`.
- **Create** `app/(dashboard)/super-admin/buildings/[id]/HeatingReadingsPanel.tsx` — the entry grid.
- **Modify** the building detail page + `BuildingDashboard.tsx` — fetch metered-heating flag + mount the panel (gated).

---

## Task 1: Schema — `UnitHeatingReading` + `Building.heatingMeterUnit` + migration

**Files:**
- Modify: `prisma/schema.prisma` (Building ~603, Unit ~1013)

- [ ] **Step 1: Add `heatingMeterUnit` to `Building`** — inside `model Building`, near the elevator scalar fields added previously:

```prisma
  heatingMeterUnit String?
```

- [ ] **Step 2: Add the back-relation to `Building`** — alongside its other relation fields:

```prisma
  heatingReadings UnitHeatingReading[]
```

- [ ] **Step 3: Add the back-relation to `Unit`** — alongside `categoryExclusions`:

```prisma
  heatingReadings UnitHeatingReading[]
```

- [ ] **Step 4: Add the new model** (place after `model UnitCategoryExclusion`):

```prisma
model UnitHeatingReading {
  id              String   @id @default(cuid())
  buildingId      String
  building        Building @relation(fields: [buildingId], references: [id], onDelete: Cascade)
  unitId          String
  unit            Unit     @relation(fields: [unitId], references: [id], onDelete: Cascade)
  period          String   // YYYY-MM
  previousReading Decimal? @db.Decimal(12, 3)
  currentReading  Decimal? @db.Decimal(12, 3)
  consumption     Decimal? @db.Decimal(12, 3)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  @@unique([unitId, period])
  @@index([buildingId, period])
}
```

- [ ] **Step 5: Generate the migration SQL without applying via migrate dev.** Create the migration directory + SQL with `migrate diff`, then apply with `migrate deploy` (the live DB has pre-existing Announcement drift that would make `migrate dev` demand a destructive reset):

```bash
mkdir -p prisma/migrations/20260621130000_unit_heating_readings
npx prisma migrate diff \
  --from-migrations prisma/migrations \
  --to-schema-datamodel prisma/schema.prisma \
  --shadow-database-url "$DATABASE_URL" \
  --script > prisma/migrations/20260621130000_unit_heating_readings/migration.sql
```
If `--from-migrations` + shadow DB is not workable in this environment, instead diff DB→schema:
```bash
npx prisma migrate diff --from-database --to-schema-datamodel prisma/schema.prisma --script \
  > prisma/migrations/20260621130000_unit_heating_readings/migration.sql
```
Inspect the SQL: it must contain only `CREATE TABLE "UnitHeatingReading"` (+ its unique & index), and `ALTER TABLE "Building" ADD COLUMN "heatingMeterUnit"`. Nothing about Announcement. Then:
```bash
npx prisma migrate deploy
npx prisma generate
```

- [ ] **Step 6: Verify the new fields compile**

Run: `npx tsc --noEmit 2>&1 | grep -iE "UnitHeatingReading|heatingMeterUnit|heatingReadings"`
Expected: NO matches (pre-existing unrelated errors elsewhere are fine).

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations lib/prisma
git commit -m "feat(schema): UnitHeatingReading per unit/period + Building.heatingMeterUnit"
```

---

## Task 2: `lib/heating-readings.ts` — consumption + map

**Files:**
- Create: `lib/heating-readings.ts`
- Test: `lib/heating-readings.test.ts`

- [ ] **Step 1: Write the failing test** — create `lib/heating-readings.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeConsumption, toConsumptionMap, type ReadingRow } from "./heating-readings";

const rows: ReadingRow[] = [
  { unitId: "a", previousReading: 1240, currentReading: 1318 }, // 78
  { unitId: "b", previousReading: 980, currentReading: 1022 },  // 42
  { unitId: "c", previousReading: 2110, currentReading: 2270 }, // 160
];

describe("computeConsumption", () => {
  it("consumption = current - previous", () => {
    const r = computeConsumption(rows);
    expect(r.find((x) => x.unitId === "a")!.consumption).toBe(78);
    expect(r.every((x) => !x.negative)).toBe(true);
  });

  it("missing reading → null consumption, not negative", () => {
    const r = computeConsumption([{ unitId: "x", previousReading: 100, currentReading: null }]);
    expect(r[0].consumption).toBeNull();
    expect(r[0].negative).toBe(false);
  });

  it("current < previous → negative flag, consumption clamped to 0", () => {
    const r = computeConsumption([{ unitId: "y", previousReading: 500, currentReading: 480 }]);
    expect(r[0].negative).toBe(true);
    expect(r[0].consumption).toBe(0);
  });

  it("missing previous treats previous as 0", () => {
    const r = computeConsumption([{ unitId: "z", previousReading: null, currentReading: 30 }]);
    expect(r[0].consumption).toBe(30);
  });
});

describe("toConsumptionMap", () => {
  it("includes only positive consumption, skips null/negative", () => {
    const m = toConsumptionMap([
      { unitId: "a", previousReading: 0, currentReading: 78 },
      { unitId: "b", previousReading: 100, currentReading: null }, // null → skip
      { unitId: "c", previousReading: 500, currentReading: 480 },  // negative → skip
    ]);
    expect(m.get("a")).toBe(78);
    expect(m.has("b")).toBe(false);
    expect(m.has("c")).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run lib/heating-readings.test.ts`
Expected: FAIL ("computeConsumption is not a function").

- [ ] **Step 3: Implement** — create `lib/heating-readings.ts`:

```ts
export type ReadingRow = { unitId: string; previousReading: number | null; currentReading: number | null };
export type ConsumptionResult = { unitId: string; consumption: number | null; negative: boolean };

/** consumption = current - previous. Missing current → null (no reading yet).
 *  Missing previous → treated as 0. current < previous → negative flag, clamped to 0
 *  (likely a meter reset / typo; never count negative usage). */
export function computeConsumption(rows: ReadingRow[]): ConsumptionResult[] {
  return rows.map((r) => {
    if (r.currentReading == null) return { unitId: r.unitId, consumption: null, negative: false };
    const prev = r.previousReading ?? 0;
    const diff = r.currentReading - prev;
    if (diff < 0) return { unitId: r.unitId, consumption: 0, negative: true };
    return { unitId: r.unitId, consumption: diff, negative: false };
  });
}

/** Map<unitId, consumption> for resolveWeights — only positive consumption. */
export function toConsumptionMap(rows: ReadingRow[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const c of computeConsumption(rows)) {
    if (c.consumption != null && c.consumption > 0) m.set(c.unitId, c.consumption);
  }
  return m;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run lib/heating-readings.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/heating-readings.ts lib/heating-readings.test.ts
git commit -m "feat(heating): pure consumption computation + map"
```

---

## Task 3: Feed real readings into allocation (`building-expenses.ts`)

**Files:**
- Modify: `app/actions/building-expenses.ts` (`loadAllocContext` ~111, `buildAllocUnits` ~149, `previewExpenseAllocation` ~166, `createBuildingExpense` ~193, `updateBuildingExpense` ~255)
- Modify: `components/buildings/ExpenseReviewForm.tsx` (the `previewExpenseAllocation` call)

- [ ] **Step 1: Add the readings import** at the top of `app/actions/building-expenses.ts`:

```ts
import { toConsumptionMap, type ReadingRow } from "@/lib/heating-readings";
```

- [ ] **Step 2: Extend `loadAllocContext`** to accept `month` and, for `METERED_70_30`, load that month's readings + the building's heating-unit label. Change its signature and add the loading logic. Replace the function header and the final `return`:

Change signature:
```ts
async function loadAllocContext(buildingId: string, categoryId: string | null, month: string | null) {
```
After `basis` is computed (just before the current `return { loaded, basis }`), add:
```ts
  let meterReadings: Map<string, number> | null = null;
  let heatingMeterUnit: string | null = null;
  if (basis === "METERED_70_30" && month) {
    const [readings, building] = await Promise.all([
      db.unitHeatingReading.findMany({ where: { buildingId, period: month }, select: { unitId: true, previousReading: true, currentReading: true } }),
      db.building.findUnique({ where: { id: buildingId }, select: { heatingMeterUnit: true } }),
    ]);
    const rows: ReadingRow[] = readings.map((r) => ({
      unitId: r.unitId,
      previousReading: r.previousReading == null ? null : Number(r.previousReading),
      currentReading: r.currentReading == null ? null : Number(r.currentReading),
    }));
    const map = toConsumptionMap(rows);
    meterReadings = map.size > 0 ? map : null; // empty → let buildAllocUnits fall back
    heatingMeterUnit = building?.heatingMeterUnit ?? null;
  }
  return { loaded, basis, meterReadings, heatingMeterUnit };
```

- [ ] **Step 3: Extend `buildAllocUnits`** to take the heating-unit label and include consumption in the note when METERED actually used readings. Replace the function:

```ts
function buildAllocUnits(loaded: LoadedUnit[], basis: DistributionBasis, meterReadings: Map<string, number> | null, heatingMeterUnit: string | null = null) {
  const weights = resolveWeights(basis, loaded, meterReadings);
  const allocUnits = loaded.map((u) => ({
    unitId: u.unitId, weight: weights.get(u.unitId) ?? 0,
    ownerUserId: u.ownerUserId, tenantUserId: u.tenantUserId,
  }));
  const participants = loaded.filter((u) => !u.excluded).length;
  const totalConsumption = meterReadings
    ? loaded.filter((u) => !u.excluded).reduce((s, u) => s + (meterReadings.get(u.unitId) ?? 0), 0)
    : 0;
  const meteredFellBack = basis === "METERED_70_30" && totalConsumption === 0;
  const label = meteredFellBack ? "χιλιοστά θέρμανσης (ελλείψει μετρήσεων)" : BASIS_LABEL[basis];
  const unitLabel = heatingMeterUnit ? ` ${heatingMeterUnit}` : "";
  const consumptionPart =
    basis === "METERED_70_30" && !meteredFellBack
      ? ` · Συνολική κατανάλωση ${totalConsumption}${unitLabel}`
      : "";
  const note = `Μέθοδος: ${label} · Συμμετέχουν ${participants}/${loaded.length} μονάδες${consumptionPart}`;
  return { allocUnits, note };
}
```

- [ ] **Step 4: Update `previewExpenseAllocation`** — add `month` to its args and thread it through:

```ts
export async function previewExpenseAllocation(buildingId: string, args: { total: number; tenantPct: number; ownerPct: number; categoryId: string | null; month: string | null }) {
  await requireBuildingAccess(buildingId);
  assertSplit(args.tenantPct, args.ownerPct);
  const { loaded, basis, meterReadings, heatingMeterUnit } = await loadAllocContext(buildingId, args.categoryId, args.month);
  const { allocUnits } = buildAllocUnits(loaded, basis, meterReadings, heatingMeterUnit);
  return computeAllocation({ total: args.total, tenantPct: args.tenantPct, ownerPct: args.ownerPct, units: allocUnits });
}
```

- [ ] **Step 5: Update `createBuildingExpense`** — pass `input.month` and the readings. Replace its loader+build lines:

```ts
  const { loaded, basis, meterReadings, heatingMeterUnit } = await loadAllocContext(buildingId, input.categoryId, input.month);
  const { allocUnits, note } = buildAllocUnits(loaded, basis, meterReadings, heatingMeterUnit);
```
(The `computeAllocation` call and the `breakdownNote: note` in `createMany` are unchanged.)

- [ ] **Step 6: Update `updateBuildingExpense`** — same, using `current.buildingId` + `input.month`:

```ts
  const { loaded, basis, meterReadings, heatingMeterUnit } = await loadAllocContext(current.buildingId, input.categoryId, input.month);
  const { allocUnits, note } = buildAllocUnits(loaded, basis, meterReadings, heatingMeterUnit);
```

- [ ] **Step 7: Update the preview caller** — in `components/buildings/ExpenseReviewForm.tsx`, find the `previewExpenseAllocation(...)` call (it currently passes `{ total, tenantPct, ownerPct, categoryId }`). Add `month`. The form already has the month value (the same `month` used when creating the expense — read the component to find the state variable, likely `month`). Add it to the args object and to the debounce effect's dependency array.

- [ ] **Step 8: Typecheck (targeted)**

Run: `npx tsc --noEmit 2>&1 | grep -E "building-expenses|ExpenseReviewForm"`
Expected: NO matches.

- [ ] **Step 9: Commit**

```bash
git add app/actions/building-expenses.ts components/buildings/ExpenseReviewForm.tsx
git commit -m "feat(expenses): feed per-unit heating readings into METERED_70_30 allocation"
```

---

## Task 4: Server actions (`app/actions/heating-readings.ts`)

**Files:**
- Create: `app/actions/heating-readings.ts`

- [ ] **Step 1: Read the auth + guard pattern** from `app/actions/building-millesimes.ts` (its `requireSuperAdmin` and `assertUnitInBuilding`). Replicate both helpers at the top of the new file (same imports: `auth` from `@/auth`, `db` from `@/lib/db`, `revalidatePath`).

- [ ] **Step 2: Create `app/actions/heating-readings.ts`:**

```ts
"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const user = await db.user.findUnique({ where: { id: session.user.id as string }, select: { role: true } });
  if (user?.role !== "SUPER_ADMIN") throw new Error("Forbidden");
}

async function assertUnitInBuilding(unitId: string, buildingId: string) {
  const unit = await db.unit.findFirst({ where: { id: unitId, buildingId }, select: { id: true } });
  if (!unit) throw new Error("Η μονάδα δεν ανήκει σε αυτό το κτήριο.");
}

/** YYYY-MM of the month before `period`. */
function prevPeriod(period: string): string {
  const [y, m] = period.split("-").map(Number);
  const d = m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 };
  return `${d.y}-${String(d.m).padStart(2, "0")}`;
}

export type HeatingReadingDTO = {
  unitId: string; unitNumber: string; floor: number | null;
  previousReading: number | null; currentReading: number | null; consumption: number | null;
};

/** Units that participate in heating for this building (excluding those with a
 *  UnitCategoryExclusion against any METERED_70_30 / heating category), with this
 *  period's readings. `previousReading` is auto-filled from the prior month's
 *  currentReading when the stored value is null. */
export async function listHeatingReadings(buildingId: string, period: string): Promise<HeatingReadingDTO[]> {
  await requireSuperAdmin();
  const heatingCatIds = (await db.expenseCategory.findMany({
    where: {
      OR: [
        { defaultBasis: "METERED_70_30" },
        { defaultBasis: "HEATING_MILLESIMES" },
        { overrides: { some: { buildingId, distributionBasis: { in: ["METERED_70_30", "HEATING_MILLESIMES"] } } } },
      ],
    },
    select: { id: true },
  })).map((c) => c.id);

  const [units, thisMonth, lastMonth] = await Promise.all([
    db.unit.findMany({
      where: { buildingId, categoryExclusions: { none: { categoryId: { in: heatingCatIds } } } },
      select: { id: true, unitNumber: true, floor: true },
      orderBy: { unitNumber: "asc" },
    }),
    db.unitHeatingReading.findMany({ where: { buildingId, period }, select: { unitId: true, previousReading: true, currentReading: true, consumption: true } }),
    db.unitHeatingReading.findMany({ where: { buildingId, period: prevPeriod(period) }, select: { unitId: true, currentReading: true } }),
  ]);

  const cur = new Map(thisMonth.map((r) => [r.unitId, r]));
  const prevCur = new Map(lastMonth.map((r) => [r.unitId, r.currentReading == null ? null : Number(r.currentReading)]));
  return units.map((u) => {
    const r = cur.get(u.id);
    const storedPrev = r?.previousReading == null ? null : Number(r.previousReading);
    return {
      unitId: u.id, unitNumber: u.unitNumber, floor: u.floor,
      previousReading: storedPrev ?? prevCur.get(u.id) ?? null,
      currentReading: r?.currentReading == null ? null : Number(r.currentReading),
      consumption: r?.consumption == null ? null : Number(r.consumption),
    };
  });
}

function consumptionOf(previous: number | null, current: number | null): number | null {
  if (current == null) return null;
  const diff = current - (previous ?? 0);
  return diff < 0 ? 0 : diff;
}

/** Upsert one unit's reading for a period. previousReading is resolved from the
 *  prior month's currentReading; consumption is derived. */
export async function saveHeatingReading(buildingId: string, unitId: string, period: string, currentReading: number | null) {
  await requireSuperAdmin();
  await assertUnitInBuilding(unitId, buildingId);
  const prevRow = await db.unitHeatingReading.findUnique({ where: { unitId_period: { unitId, period: prevPeriod(period) } }, select: { currentReading: true } });
  const previous = prevRow?.currentReading == null ? null : Number(prevRow.currentReading);
  const consumption = consumptionOf(previous, currentReading);
  await db.unitHeatingReading.upsert({
    where: { unitId_period: { unitId, period } },
    create: { buildingId, unitId, period, previousReading: previous, currentReading, consumption },
    update: { previousReading: previous, currentReading, consumption },
  });
  revalidatePath(`/super-admin/buildings/${buildingId}`);
  return { ok: true };
}

/** Save many readings for a period in one transaction. */
export async function bulkSaveHeatingReadings(buildingId: string, period: string, items: { unitId: string; currentReading: number | null }[]) {
  await requireSuperAdmin();
  const prevRows = await db.unitHeatingReading.findMany({ where: { buildingId, period: prevPeriod(period) }, select: { unitId: true, currentReading: true } });
  const prevMap = new Map(prevRows.map((r) => [r.unitId, r.currentReading == null ? null : Number(r.currentReading)]));
  await db.$transaction(items.map((it) => {
    const previous = prevMap.get(it.unitId) ?? null;
    const consumption = consumptionOf(previous, it.currentReading);
    return db.unitHeatingReading.upsert({
      where: { unitId_period: { unitId: it.unitId, period } },
      create: { buildingId, unitId: it.unitId, period, previousReading: previous, currentReading: it.currentReading, consumption },
      update: { previousReading: previous, currentReading: it.currentReading, consumption },
    });
  }));
  revalidatePath(`/super-admin/buildings/${buildingId}`);
  return { count: items.length };
}

/** Set the building's heating meter unit label (e.g. "μονάδες"). */
export async function saveHeatingMeterUnit(buildingId: string, label: string | null) {
  await requireSuperAdmin();
  await db.building.update({ where: { id: buildingId }, data: { heatingMeterUnit: label } });
  revalidatePath(`/super-admin/buildings/${buildingId}`);
  return { ok: true };
}
```

- [ ] **Step 3: Typecheck (targeted)**

Run: `npx tsc --noEmit 2>&1 | grep "heating-readings"`
Expected: NO matches. (If the compound key `unitId_period` errors, confirm the schema `@@unique([unitId, period])` migrated — it generates `unitId_period`.)

- [ ] **Step 4: Commit**

```bash
git add app/actions/heating-readings.ts
git commit -m "feat(heating): server actions for per-unit readings + meter-unit label"
```

---

## Task 5: UI — `HeatingReadingsPanel.tsx` + gated mount

**Files:**
- Create: `app/(dashboard)/super-admin/buildings/[id]/HeatingReadingsPanel.tsx`
- Modify: building detail `page.tsx` and `app/(dashboard)/super-admin/buildings/[id]/BuildingDashboard.tsx`

- [ ] **Step 1: Read conventions** — read `MillesimeGrid.tsx` and `ExclusionMatrix.tsx` (created in the prior feature) in the same folder to match: `"use client"`, `useTransition`, `router.refresh()`, native inputs/checkboxes, `react-icons/ri` *Line icons, inline-style tables. Also read `BuildingDashboard.tsx` to see the tab-host pattern and how the `millesimes` tab was added.

- [ ] **Step 2: Create `HeatingReadingsPanel.tsx`:**

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RiSave3Line, RiAlertLine } from "react-icons/ri";
import { saveHeatingReading, bulkSaveHeatingReadings, saveHeatingMeterUnit, type HeatingReadingDTO } from "@/app/actions/heating-readings";

type Props = {
  buildingId: string;
  period: string;                 // current YYYY-MM
  periods: string[];              // selectable months (newest first)
  rows: HeatingReadingDTO[];
  heatingMeterUnit: string | null;
};

export function HeatingReadingsPanel({ buildingId, period, periods, rows, heatingMeterUnit }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<Record<string, string>>(
    () => Object.fromEntries(rows.map((r) => [r.unitId, r.currentReading?.toString() ?? ""])),
  );

  const consumptionOf = (r: HeatingReadingDTO): number | null => {
    const v = draft[r.unitId];
    if (v === "" || v == null) return null;
    const cur = Number(v);
    if (Number.isNaN(cur)) return null;
    const diff = cur - (r.previousReading ?? 0);
    return diff;
  };
  const total = rows.reduce((s, r) => { const c = consumptionOf(r); return s + (c && c > 0 ? c : 0); }, 0);

  function changePeriod(p: string) {
    const url = new URL(window.location.href);
    url.searchParams.set("heatingPeriod", p);
    router.push(url.pathname + url.search);
  }

  function saveAll() {
    startTransition(async () => {
      await bulkSaveHeatingReadings(
        buildingId, period,
        rows.map((r) => ({ unitId: r.unitId, currentReading: draft[r.unitId] === "" ? null : Number(draft[r.unitId]) })),
      );
      router.refresh();
    });
  }

  function saveLabel(label: string) {
    startTransition(async () => { await saveHeatingMeterUnit(buildingId, label || null); router.refresh(); });
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 12 }}>
        <label>Περίοδος:{" "}
          <select value={period} onChange={(e) => changePeriod(e.target.value)}>
            {periods.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label>Μονάδα μέτρησης:{" "}
          <input defaultValue={heatingMeterUnit ?? ""} placeholder="π.χ. μονάδες" onBlur={(e) => saveLabel(e.target.value)} />
        </label>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: "#f4f4f6", textAlign: "right" }}>
            <th style={{ textAlign: "left", padding: 8 }}>Μονάδα</th>
            <th>Προηγ.</th><th>Τρέχουσα</th><th>Κατανάλωση</th><th>Μερίδιο 70%</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const c = consumptionOf(r);
            const negative = c != null && c < 0;
            const pct = total > 0 && c != null && c > 0 ? (c / total) * 100 : 0;
            return (
              <tr key={r.unitId} style={{ borderTop: "1px solid #eee", textAlign: "right" }}>
                <td style={{ textAlign: "left", padding: 8 }}>{r.unitNumber}</td>
                <td style={{ color: "#999" }}>{r.previousReading ?? "—"}</td>
                <td>
                  <input
                    style={{ width: 80, textAlign: "right" }}
                    value={draft[r.unitId] ?? ""}
                    inputMode="decimal"
                    onChange={(e) => setDraft((d) => ({ ...d, [r.unitId]: e.target.value }))}
                    onBlur={(e) => startTransition(async () => { await saveHeatingReading(buildingId, r.unitId, period, e.target.value === "" ? null : Number(e.target.value)); router.refresh(); })}
                  />
                </td>
                <td style={{ fontWeight: 600, color: negative ? "#c00" : undefined }}>
                  {c == null ? "—" : negative ? <span><RiAlertLine style={{ verticalAlign: "middle" }} /> {c}</span> : c}
                </td>
                <td style={{ color: "#888" }}>{pct ? pct.toFixed(1) + "%" : "—"}</td>
              </tr>
            );
          })}
          <tr style={{ borderTop: "2px solid #ddd", fontWeight: 700, background: "#fafafa", textAlign: "right" }}>
            <td style={{ textAlign: "left", padding: 8 }}>Σύνολο</td>
            <td></td><td></td><td>{total}</td><td>100%</td>
          </tr>
        </tbody>
      </table>

      <button onClick={saveAll} disabled={pending} style={{ marginTop: 12 }}>
        <RiSave3Line style={{ verticalAlign: "middle" }} /> Αποθήκευση όλων
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Fetch data + gate in the building detail `page.tsx`.** Compute whether the building uses metered heating, and if so load the panel data. Add to the page's server-side data fetching:

```ts
const usesMeteredHeating =
  (await db.expenseCategory.count({
    where: {
      OR: [
        { defaultBasis: "METERED_70_30" },
        { overrides: { some: { buildingId: building.id, distributionBasis: "METERED_70_30" } } },
      ],
    },
  })) > 0;

// current heating period: ?heatingPeriod=YYYY-MM or the latest expense month or current month
const heatingPeriod =
  (typeof searchParams?.heatingPeriod === "string" ? searchParams.heatingPeriod : null)
  ?? (await db.buildingExpense.findFirst({ where: { buildingId: building.id }, orderBy: { month: "desc" }, select: { month: true } }))?.month
  ?? new Date().toISOString().slice(0, 7);

const heatingPeriods = usesMeteredHeating
  ? (await db.buildingExpense.findMany({ where: { buildingId: building.id }, select: { month: true }, distinct: ["month"], orderBy: { month: "desc" } })).map((r) => r.month)
  : [];
const heatingReadingRows = usesMeteredHeating ? await listHeatingReadings(building.id, heatingPeriod) : [];
```
Import `listHeatingReadings` from `@/app/actions/heating-readings`. (If the page component doesn't already receive `searchParams`, add it to the page props per the Next.js version's convention — check a sibling page for whether `searchParams` is a promise that must be awaited.)

- [ ] **Step 4: Mount the panel (gated) in `BuildingDashboard.tsx`.** Pass the new props down from the page. Render `HeatingReadingsPanel` only when `usesMeteredHeating`. Place it inside the existing `millesimes` tab below the other panels (or add a dedicated «Ενδείξεις θέρμανσης» section). Match how `MillesimeGrid`/`ExclusionMatrix` are already mounted:

```tsx
{usesMeteredHeating && (
  <HeatingReadingsPanel
    buildingId={building.id}
    period={heatingPeriod}
    periods={heatingPeriods}
    rows={heatingReadingRows}
    heatingMeterUnit={building.heatingMeterUnit ?? null}
  />
)}
```
Add `usesMeteredHeating`, `heatingPeriod`, `heatingPeriods`, `heatingReadingRows` to `BuildingDashboard`'s props/types and ensure `building.heatingMeterUnit` is selected by the page query.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit 2>&1 | grep -E "HeatingReadingsPanel|buildings/\[id\]/page|BuildingDashboard"`
Expected: NO matches.
Run: `npm run lint 2>&1 | tail -20` — fix any lint errors in the new/changed files only.

- [ ] **Step 6: Manual smoke (optional, if a dev DB is available)**

Run: `npm run dev`
For a building with a category set to METERED_70_30: open the building → the «Ενδείξεις θέρμανσης» panel appears; enter current readings → consumption + 70% share update; «Αποθήκευση όλων» persists; create a heating expense for that month → the shop/excluded units are absent and shares reflect consumption.

- [ ] **Step 7: Commit**

```bash
git add "app/(dashboard)/super-admin/buildings/[id]"
git commit -m "feat(ui): heating readings panel (gated on metered heating)"
```

---

## Task 6: Full suite + final check

**Files:** none (verification)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS — including `lib/heating-readings.test.ts` plus the existing millesimes/basis/allocation suites.

- [ ] **Step 2: Targeted typecheck of all feature files**

Run: `npx tsc --noEmit 2>&1 | grep -E "heating-readings|building-expenses|HeatingReadingsPanel|BuildingDashboard|buildings/\[id\]/page"`
Expected: NO matches.

- [ ] **Step 3: Commit any stragglers**

```bash
git add -A
git commit -m "chore(heating): final verification" --allow-empty
```

---

## Notes for the implementer

- **No new math:** `resolveWeights("METERED_70_30", …)` already does 70/30. This feature only supplies the consumption map and the entry/printout around it.
- **Empty readings → safe fallback:** when a period has no readings, `loadAllocContext` passes `null`, `resolveWeights` falls back to pure heating millesimes, and the note says so («ελλείψει μετρήσεων»).
- **Decimal handling:** Prisma returns `Decimal` for the reading columns — always convert with `Number(...)` before arithmetic (done in the actions and DTOs).
- **Auto-previous chain:** `previousReading` is always derived from the prior month's `currentReading` at save time; the grid shows it read-only.
- **Gating:** the panel only renders for buildings with a METERED_70_30 category (default or override) — no noise for buildings on central heating.
