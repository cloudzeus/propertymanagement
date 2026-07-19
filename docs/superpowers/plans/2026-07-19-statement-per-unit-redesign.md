# Ειδοποιητήριο Per-Unit Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Per-apartment ειδοποιητήριο with full ΑΝΑΛΥΣΗ ΔΑΠΑΝΩΝ + ΑΝΑΛΟΓΙΑ ΔΙΑΜΕΡΙΣΜΑΤΟΣ (χιλιοστά, ποσό, owner/tenant split), unit selector for multi-unit owners, classic A4 print.

**Architecture:** New pure `buildUnitStatement` in `lib/building/statement.ts` (TDD); `occupant-data.ts` returns `statements: UnitStatement[]` + `managerName`; `StatementView.tsx` renders one unit's notice with a unit selector; A4 print rules in `globals.css`.

**Tech Stack:** Next.js 16, Prisma 7, Orithon tokens, react-icons/ri, vitest.

**Spec:** `docs/superpowers/specs/2026-07-19-statement-per-unit-redesign-design.md`

Conventions: branch `main`; stage only touched files; trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`. Ignore pre-existing failures: vitest `lib/cms/landing-types.test.ts`; tsc `app/actions/auth.ts`, `lib/otp.ts`, `prisma.config.ts`, `prisma/seed.ts`, `app/api/super-admin/costs/*`, `components/forms/ForgotPasswordForm.tsx`.

---

### Task 1: `buildUnitStatement` (TDD)

**Files:** Modify `lib/building/statement.ts`; append `lib/building/statement.test.ts`.

- [ ] **Step 1: Failing tests** — append:

```ts
import { buildUnitStatement, type UnitStatementInput } from "./statement";

const uexp = (o: Partial<UnitStatementInput>): UnitStatementInput => ({
  id: "e", categoryName: "Καθαριότητα", basis: "GENERAL_MILLESIMES", amount: 100,
  tenantPct: 100, ownerPct: 0, unitAmount: 10, unitTenant: 10, unitOwner: 0, ...o,
});

describe("buildUnitStatement", () => {
  const unit = { unitId: "u1", unitNumber: "3", unitType: "APARTMENT", floor: 2, role: "BOTH" as const,
    millesimes: 159.84, millesimesElevator: 150, millesimesHeating: 160 };

  it("groups, splits owner/tenant per group, computes myPayable for BOTH (self-occupied)", () => {
    const s = buildUnitStatement(unit, [
      uexp({ id: "a", amount: 60, unitAmount: 6, unitTenant: 6, unitOwner: 0 }),
      uexp({ id: "b", categoryName: "ΔΕΗ", amount: 40, unitAmount: 4, unitTenant: 4, unitOwner: 0 }),
      uexp({ id: "c", categoryName: "Ασφάλιστρα", basis: "GENERAL_MILLESIMES", tenantPct: 0, ownerPct: 100, amount: 200, unitAmount: 20, unitTenant: 0, unitOwner: 20 }),
    ]);
    const a = s.groups.find((g) => g.key === "A")!;
    expect(a.buildingTotal).toBe(100);
    expect(a.lines.length).toBe(2);
    expect(a.unitAmount).toBe(10);
    expect(a.unitTenant).toBe(10);
    expect(a.appliedMillesimes).toBe(159.84);        // group A → general millesimes
    const e = s.groups.find((g) => g.key === "E")!;
    expect(e.unitOwner).toBe(20);
    expect(s.total).toBe(30);
    expect(s.tenantTotal).toBe(10);
    expect(s.ownerTotal).toBe(20);
    expect(s.myPayable).toBe(30);                    // BOTH → owner + tenant
  });

  it("myPayable = owner only when the unit is rented out (role OWNER)", () => {
    const s = buildUnitStatement({ ...unit, role: "OWNER" }, [
      uexp({ amount: 100, unitAmount: 10, unitTenant: 10, unitOwner: 0 }),
      uexp({ id: "x", basis: "ELEVATOR_MILLESIMES", tenantPct: 0, ownerPct: 100, amount: 50, unitAmount: 5, unitTenant: 0, unitOwner: 5 }),
    ]);
    expect(s.tenantTotal).toBe(10);
    expect(s.ownerTotal).toBe(5);
    expect(s.myPayable).toBe(5);
    expect(s.groups.find((g) => g.key === "B")!.appliedMillesimes).toBe(150); // elevator
  });

  it("myPayable = tenant only for a plain resident (role RESIDENT)", () => {
    const s = buildUnitStatement({ ...unit, role: "RESIDENT" }, [uexp({ amount: 100, unitAmount: 10, unitTenant: 10, unitOwner: 0 })]);
    expect(s.myPayable).toBe(10);
  });

  it("omits empty groups and orders Α-Ε", () => {
    const s = buildUnitStatement(unit, [uexp({}), uexp({ id: "h", basis: "HEATING_MILLESIMES", unitAmount: 3, unitTenant: 3, unitOwner: 0 })]);
    expect(s.groups.map((g) => g.key)).toEqual(["A", "C"]);
  });
});
```

- [ ] **Step 2:** Run → FAIL. Implement in `lib/building/statement.ts` (keep existing exports):

```ts
export type UnitStatementInput = StatementExpense & { unitAmount: number; unitTenant: number; unitOwner: number };

export type UnitStatementGroup = {
  key: StatementGroupKey; label: string; buildingTotal: number;
  lines: { id: string; categoryName: string; amount: number }[];
  appliedMillesimes: number | null;
  unitAmount: number; unitTenant: number; unitOwner: number;
};

export type UnitStatementMeta = {
  unitId: string; unitNumber: string; unitType: string; floor: number | null;
  role: "OWNER" | "RESIDENT" | "BOTH";
  millesimes: number | null; millesimesElevator: number | null; millesimesHeating: number | null;
};

export type UnitStatement = UnitStatementMeta & {
  groups: UnitStatementGroup[];
  total: number; tenantTotal: number; ownerTotal: number; myPayable: number;
};

function millesimesForGroup(m: UnitStatementMeta, key: StatementGroupKey): number | null {
  if (key === "B") return m.millesimesElevator;
  if (key === "C") return m.millesimesHeating;
  return m.millesimes; // A, D, E → general
}

export function buildUnitStatement(unit: UnitStatementMeta, rows: UnitStatementInput[]): UnitStatement {
  const order: StatementGroupKey[] = ["A", "B", "C", "D", "E"];
  const groups = new Map<StatementGroupKey, UnitStatementGroup>();
  let total = 0, tenantTotal = 0, ownerTotal = 0;
  for (const r of rows) {
    const key = groupForBasis(r.basis, r.tenantPct);
    let g = groups.get(key);
    if (!g) g = { key, label: GROUP_LABELS[key], buildingTotal: 0, lines: [], appliedMillesimes: millesimesForGroup(unit, key), unitAmount: 0, unitTenant: 0, unitOwner: 0 }, groups.set(key, g);
    g.buildingTotal += r.amount;
    g.lines.push({ id: r.id, categoryName: r.categoryName, amount: r.amount });
    g.unitAmount += r.unitAmount; g.unitTenant += r.unitTenant; g.unitOwner += r.unitOwner;
    total += r.unitAmount; tenantTotal += r.unitTenant; ownerTotal += r.unitOwner;
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  const myPayable =
    (unit.role === "OWNER" || unit.role === "BOTH" ? ownerTotal : 0) +
    (unit.role === "RESIDENT" || unit.role === "BOTH" ? tenantTotal : 0);
  return {
    ...unit,
    groups: order.filter((k) => groups.has(k)).map((k) => {
      const g = groups.get(k)!;
      return { ...g, buildingTotal: round(g.buildingTotal), unitAmount: round(g.unitAmount), unitTenant: round(g.unitTenant), unitOwner: round(g.unitOwner) };
    }),
    total: round(total), tenantTotal: round(tenantTotal), ownerTotal: round(ownerTotal), myPayable: round(myPayable),
  };
}
```

- [ ] **Step 3:** Run → PASS. `npx tsc --noEmit 2>&1 | grep statement` empty. Commit `feat(building): per-unit statement builder`.

---

### Task 2: occupant-data returns per-unit statements + managerName

**Files:** Modify `lib/building/occupant-data.ts`.

- [ ] **Step 1:** In the per-expense loop, instead of summing across all units into `myShare/myTenant/myOwner`, keep the per-unit allocation values available. Build, for each of the viewer's units, a `UnitStatementInput[]` (only expenses that have an allocation for that unit) and call `buildUnitStatement(unitMeta, rows)`. `unitMeta.role`: OWNER if only ownerSide, RESIDENT if only tenantSide, BOTH if both (self-occupied owner). Return `statements: UnitStatement[]` (ordered by unitNumber). Keep `paid` as an overall flag OR compute per-unit — expose `statements[i].myPayable` and a per-unit paid state: add `tenantPaid`/`ownerPaid` booleans to `UnitStatement` via a thin wrapper object in occupant-data (or extend the return with a parallel `paidByUnit` map keyed by unitId). Simplest: occupant-data returns `statements` where each item is `UnitStatement & { tenantPaid: boolean | null; ownerPaid: boolean | null }`.
- [ ] **Step 2:** Add `managerName`: query building contacts (`db.contact.findFirst({ where: { buildingId, category: { contains: "ιαχειρ" } } })`) → name; fallback null. (Cheap; the contacts list is already fetched — derive from it instead of a new query if present.) Add to the return object.
- [ ] **Step 3:** Remove the now-unused single `statement`/`buildStatement` usage from occupant-data IF nothing else consumes it; keep the `paid` object only if the overview uses it (check OccupantBuildingShell overview — if it reads `statement`/`paid`, adapt it to `statements`). `npx tsc --noEmit 2>&1 | grep occupant-data` empty. Commit `feat(building): per-unit statements + manager name in occupant data`.

---

### Task 3: StatementView redesign + A4 print

**Files:** Modify `components/building/occupant-shell/StatementView.tsx`, `components/building/occupant-shell/OccupantBuildingShell.tsx` (prop wiring + overview if it referenced old statement), `app/globals.css`.

- [ ] **Step 1:** StatementView props → `{ building, statements, months, selectedMonth, managerName, heatingReadings }`. Unit selector `<select>` (no-print) when `statements.length > 1`, URL `?s=koino&month=&unit=<unitId>`; selected unit = `unit` param if valid else `statements[0]`. Render for the selected unit:
  - Header box: ΕΙΔΟΠΟΙΗΤΗΡΙΟ ΚΟΙΝΟΧΡΗΣΤΩΝ; cells Πολυκατοικία (name+address), Μήνας, Διαμέρισμα (number · floor · type · role badge Ιδιοκτήτης/Ένοικος/Ιδιοκατοίκηση), Χιλιοστά (κανον./ανελκ./θέρμ.).
  - **ΑΝΑΛΥΣΗ ΔΑΠΑΝΩΝ**: per group table — Κατηγορία | Δαπάνη κτηρίου; group subtotal (buildingTotal).
  - **ΑΝΑΛΟΓΙΑ ΔΙΑΜΕΡΙΣΜΑΤΟΣ**: one table, row per group — Ομάδα | Χιλιοστά (appliedMillesimes ‰) | Ποσό αναλογίας (unitAmount) | Ιδιοκτήτη (unitOwner) | Ενοίκου (unitTenant); grand total row (total / ownerTotal / tenantTotal).
  - Footer: big **ΠΛΗΡΩΤΕΟ ΠΟΣΟ** = `myPayable` with a role-aware caption («ως ιδιοκτήτης» / «ως ένοικος» / «ιδιοκτήτης + ένοικος»), paid badge from tenantPaid/ownerPaid relevant to role; below: manager signature line («Ο/Η Διαχειριστής/τρια» + managerName when present).
  - Heating readings block under group Γ analysis when present.
  - Empty-month state as before.
- [ ] **Step 2:** OccupantBuildingShell: pass `statements`/`managerName`; if its Overview tile used the old `statement.myTotal`/`paid`, switch to summing `statements[].myPayable` (total across the viewer's units) + settled = all units' relevant sides paid.
- [ ] **Step 3:** `app/globals.css` print block — within `@media print`, add: `@page { size: A4; margin: 12mm }`; inside `.statement-print-root` force `color:#000; background:#fff`; all `table, th, td, [data-boxed]` → `border-color:#000 !important`; `font-size: 10pt`; `tr { break-inside: avoid }`; keep `.no-print { display:none !important }`. Give the boxed containers a `data-boxed` attribute so the print rule can target them (or target by class). Verify a normal page print is unaffected (scoping via `body:has(.statement-print-root)`).
- [ ] **Step 4:** `npx tsc --noEmit 2>&1 | grep -E "StatementView|OccupantBuildingShell|occupant-shell"` empty; `npm run build`. Commit `feat(building): per-unit ειδοποιητήριο view with owner/tenant analysis and A4 print`.

---

### Task 4: Verification + ship

- [ ] `npx vitest run` (buildUnitStatement green; only pre-existing failure); `npx tsc --noEmit`; `npm run build`.
- [ ] Live tsx check for Λυδία's building `cmqkheuaj0003qnd4863aygce`: `statements.length === 3`; unit 3 (self-occupied) role BOTH, myPayable = tenant+owner; units 1/2 role OWNER, myPayable = owner share; group totals match building expenses of the month.
- [ ] Dev smoke: `/building/[id]?s=koino` renders; unit selector switches; no 500s.
- [ ] Final review agent; fix; update memory; push to GitHub main.
