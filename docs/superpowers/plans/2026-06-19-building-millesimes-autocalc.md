# Building Millèsimes Auto-Calculation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a building-level action that auto-distributes χιλιοστά (‰) across a building's units proportionally to their τετραγωνικά, with a preview modal before applying.

**Architecture:** A pure function `computeMillesimes` (in `lib/millesimes.ts`) does the math and is unit-tested in isolation. A server action `recalculateMillesimes` reads the building's units, runs the same function, and persists in a transaction. A new `MillesimesModal` in `CustomerTree.tsx` previews the result (using the same pure function client-side) and calls the action on confirm. A new entry is added to the building kebab dropdown.

**Tech Stack:** Next.js 16.2, Prisma 7 (PostgreSQL), TypeScript, React, Vitest (added in Task 1).

---

## File Structure

- `lib/millesimes.ts` — **create** — pure `computeMillesimes` function + types. No deps.
- `lib/millesimes.test.ts` — **create** — Vitest unit tests for the pure function.
- `vitest.config.ts` — **create** — minimal Vitest config (node environment).
- `package.json` — **modify** — add `vitest` devDep + `test` script.
- `app/actions/buildings.ts` — **modify** — add `recalculateMillesimes` server action.
- `app/(dashboard)/super-admin/customers/CustomerTree.tsx` — **modify** — add dropdown
  action + `MillesimesModal` component + modal-state variant.

---

## Task 1: Set up Vitest

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Install Vitest**

Run: `npm install -D vitest`
Expected: adds `vitest` to devDependencies, exits 0.

- [ ] **Step 2: Add the test script**

Modify `package.json` `"scripts"` — add this line (after `"lint": "eslint",`):

```json
    "test": "vitest run",
```

- [ ] **Step 3: Create the Vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: Verify the runner works (no tests yet)**

Run: `npx vitest run`
Expected: exits 0 with "No test files found" (or runs 0 files). This confirms Vitest is installed and configured.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add vitest for unit testing"
```

---

## Task 2: Pure `computeMillesimes` function (TDD)

**Files:**
- Create: `lib/millesimes.ts`
- Test: `lib/millesimes.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/millesimes.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeMillesimes } from "./millesimes";

// Helper: sum of non-null millesimes, rounded to 2 decimals to kill fp noise.
function sum(results: { millesimes: number | null }[]): number {
  return Math.round(results.reduce((s, r) => s + (r.millesimes ?? 0), 0) * 100) / 100;
}

describe("computeMillesimes", () => {
  it("distributes equal areas and sums to exactly 1000", () => {
    const res = computeMillesimes([
      { id: "a", areaSqm: 100 },
      { id: "b", areaSqm: 100 },
      { id: "c", areaSqm: 100 },
    ]);
    expect(sum(res)).toBe(1000);
    // Each ~333.33; the rounding remainder (+0.01) lands on the first largest.
    const byId = Object.fromEntries(res.map((r) => [r.id, r.millesimes]));
    expect(byId.a).toBe(333.34);
    expect(byId.b).toBe(333.33);
    expect(byId.c).toBe(333.33);
  });

  it("distributes unequal areas proportionally and sums to exactly 1000", () => {
    const res = computeMillesimes([
      { id: "a", areaSqm: 50 },
      { id: "b", areaSqm: 150 },
      { id: "c", areaSqm: 300 },
    ]);
    expect(sum(res)).toBe(1000);
    const byId = Object.fromEntries(res.map((r) => [r.id, r.millesimes]));
    // 50/500=100, 150/500=300, 300/500=600
    expect(byId.a).toBe(100);
    expect(byId.b).toBe(300);
    expect(byId.c).toBe(600);
  });

  it("excludes units without area (returns null) and ignores them in the distribution", () => {
    const res = computeMillesimes([
      { id: "a", areaSqm: 100 },
      { id: "b", areaSqm: null },
      { id: "c", areaSqm: 100 },
    ]);
    const byId = Object.fromEntries(res.map((r) => [r.id, r.millesimes]));
    expect(byId.b).toBeNull();
    expect(sum(res)).toBe(1000);
    expect(byId.a).toBe(500);
    expect(byId.c).toBe(500);
  });

  it("returns all null when no unit has area", () => {
    const res = computeMillesimes([
      { id: "a", areaSqm: null },
      { id: "b", areaSqm: 0 },
    ]);
    expect(res.every((r) => r.millesimes === null)).toBe(true);
  });

  it("assigns 1000 to a single unit with area", () => {
    const res = computeMillesimes([{ id: "a", areaSqm: 80 }]);
    expect(res[0].millesimes).toBe(1000);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/millesimes.test.ts`
Expected: FAIL — `computeMillesimes` is not exported / module has no implementation.

- [ ] **Step 3: Write the implementation**

Create `lib/millesimes.ts`:

```ts
export type MillesimeInput = { id: string; areaSqm: number | null };
export type MillesimeResult = { id: string; millesimes: number | null };

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Distribute 1000 χιλιοστά across units proportionally to their τετραγωνικά.
 * Units with no/zero area get `millesimes: null` and are excluded from the
 * distribution. The rounding remainder is absorbed by the largest-area unit so
 * the non-null results sum to exactly 1000.00.
 */
export function computeMillesimes(units: MillesimeInput[]): MillesimeResult[] {
  const withArea = units.filter((u) => u.areaSqm != null && u.areaSqm > 0);
  const total = withArea.reduce((s, u) => s + (u.areaSqm as number), 0);

  if (total <= 0) {
    return units.map((u) => ({ id: u.id, millesimes: null }));
  }

  // Proportional, rounded to 2 decimals.
  const raw = new Map<string, number>();
  for (const u of withArea) {
    raw.set(u.id, round2(((u.areaSqm as number) / total) * 1000));
  }

  // Remainder correction → largest-area unit (first one wins on ties).
  const assigned = [...raw.values()].reduce((s, v) => s + v, 0);
  const remainder = round2(1000 - assigned);
  if (remainder !== 0) {
    const largest = withArea.reduce((a, b) =>
      (b.areaSqm as number) > (a.areaSqm as number) ? b : a
    );
    raw.set(largest.id, round2((raw.get(largest.id) as number) + remainder));
  }

  return units.map((u) => ({
    id: u.id,
    millesimes: raw.has(u.id) ? (raw.get(u.id) as number) : null,
  }));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/millesimes.test.ts`
Expected: PASS — all 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/millesimes.ts lib/millesimes.test.ts
git commit -m "feat: add computeMillesimes pure function with tests"
```

---

## Task 3: `recalculateMillesimes` server action

**Files:**
- Modify: `app/actions/buildings.ts`

> Note: `app/actions/buildings.ts` already imports `auth`, `db`, `revalidatePath` and
> contains an internal `requireStaff`-style guard used by the other building actions.
> Reuse the existing guard pattern. If the existing guard is named differently, match it.

- [ ] **Step 1: Confirm the existing auth guard + imports**

Run: `grep -nE "requireStaff|requireAuth|requireAdmin|^import|revalidatePath" app/actions/buildings.ts | head -20`
Expected: shows the guard helper name and that `db` + `revalidatePath` are imported.
Use the discovered guard name in Step 2 (referred to below as `requireStaff()`).

- [ ] **Step 2: Add the action**

Add to the top imports of `app/actions/buildings.ts` (if not already present):

```ts
import { computeMillesimes } from "@/lib/millesimes";
```

Append this action at the end of `app/actions/buildings.ts`:

```ts
/** Auto-distribute χιλιοστά across a building's units, proportional to area. */
export async function recalculateMillesimes(buildingId: string) {
  await requireStaff();

  const building = await db.building.findUnique({
    where: { id: buildingId },
    select: {
      property: { select: { id: true } },
      units: { select: { id: true, areaSqm: true } },
    },
  });
  if (!building) return { error: "Το κτήριο δεν βρέθηκε" };

  const results = computeMillesimes(building.units);
  const updates = results.filter((r) => r.millesimes != null);
  if (updates.length === 0) {
    return { error: "Καμία μονάδα δεν έχει τετραγωνικά για υπολογισμό" };
  }

  await db.$transaction(
    updates.map((r) =>
      db.unit.update({ where: { id: r.id }, data: { millesimes: r.millesimes } })
    )
  );

  revalidatePath(`/super-admin/properties/${building.property.id}`);
  return { updated: updates.length };
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "buildings.ts" || echo "OK"`
Expected: `OK` (no errors referencing buildings.ts).

- [ ] **Step 4: Commit**

```bash
git add app/actions/buildings.ts
git commit -m "feat: add recalculateMillesimes server action"
```

---

## Task 4: Preview modal + dropdown action

**Files:**
- Modify: `app/(dashboard)/super-admin/customers/CustomerTree.tsx`

- [ ] **Step 1: Add the import**

In the icon import block of `CustomerTree.tsx` add `RiCalculatorLine`, and add the action +
function imports. At the top, the `buildings` action import currently is:

```ts
import {
  createBuilding, updateBuilding, deleteBuilding,
  createUnit, updateUnit, deleteUnit,
  createCommonArea, deleteCommonArea,
} from "@/app/actions/buildings";
```

Replace with:

```ts
import {
  createBuilding, updateBuilding, deleteBuilding,
  createUnit, updateUnit, deleteUnit,
  createCommonArea, deleteCommonArea,
  recalculateMillesimes,
} from "@/app/actions/buildings";
import { computeMillesimes } from "@/lib/millesimes";
```

And in the `react-icons/ri` import list, add `RiCalculatorLine` to the existing names.

- [ ] **Step 2: Add the modal-state variant**

In the `Modal_` union type (around line 30), add a variant before `| null`:

```ts
  | { kind: "millesimes"; building: TBuilding }
```

- [ ] **Step 3: Add the dropdown action**

In the building `Row`'s `actions={[...]}` array (the one with "Επεξεργασία", "Προσθήκη
ορόφου"…), insert this entry immediately BEFORE the "Διαγραφή" entry:

```tsx
                { label: "Υπολογισμός χιλιοστών", icon: <RiCalculatorLine />, onClick: () => setModal({ kind: "millesimes", building: b }) },
```

- [ ] **Step 4: Render the modal**

Where the other modals are rendered (the `{modal?.kind === "building" && ...}` block near
the bottom of `BuildingsTree`), add:

```tsx
      {modal?.kind === "millesimes" && <MillesimesModal building={modal.building} onClose={close} onDone={done} />}
```

- [ ] **Step 5: Implement the `MillesimesModal` component**

Add this component near the other modal components (e.g. after `UnitModal`) in
`CustomerTree.tsx`:

```tsx
function MillesimesModal({ building, onClose, onDone }: { building: TBuilding; onClose: () => void; onDone: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const units = building.units;
  const computed = computeMillesimes(units.map((u) => ({ id: u.id, areaSqm: u.areaSqm })));
  const newById = Object.fromEntries(computed.map((c) => [c.id, c.millesimes]));
  const totalSqm = units.reduce((s, u) => s + (u.areaSqm ?? 0), 0);
  const totalNew = computed.reduce((s, c) => s + (c.millesimes ?? 0), 0);
  const missing = units.filter((u) => !(u.areaSqm != null && u.areaSqm > 0)).length;
  const canApply = units.some((u) => u.areaSqm != null && u.areaSqm > 0);

  function apply() {
    setError(null);
    startTransition(async () => {
      const res = await recalculateMillesimes(building.id);
      if (res && "error" in res && res.error) { setError(res.error); return; }
      onDone();
    });
  }

  return (
    <Modal open onClose={onClose} title={`Υπολογισμός χιλιοστών — ${building.name}`} width={560}
      footer={<>
        <button onClick={onClose} style={cancelBtn}>Ακύρωση</button>
        <button onClick={apply} disabled={isPending || !canApply} style={saveBtn}>
          {isPending ? <RiLoaderLine style={{ animation: "spin 1s linear infinite" }} /> : <RiCheckLine />} Εφαρμογή σε όλες
        </button>
      </>}>
      {error && <div style={{ padding: "8px 12px", borderRadius: 6, background: "#fee2e218", color: "#dc2626", fontSize: 12, border: "1px solid #fca5a530", marginBottom: 12 }}>{error}</div>}

      {!canApply && (
        <div style={{ padding: "8px 12px", borderRadius: 6, background: "#fee2e218", color: "#dc2626", fontSize: 12, marginBottom: 12 }}>
          Καμία μονάδα δεν έχει τετραγωνικά. Συμπληρώστε τ.μ. στις μονάδες πρώτα.
        </div>
      )}
      {missing > 0 && canApply && (
        <div style={{ padding: "8px 12px", borderRadius: 6, background: "#fef9c318", color: "#a16207", fontSize: 12, border: "1px solid #fde04740", marginBottom: 12 }}>
          {missing} μονάδες χωρίς τ.μ. — δεν θα ενημερωθούν.
        </div>
      )}

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: "left", color: "var(--muted-foreground)", fontSize: 11 }}>
            <th style={{ padding: "6px 8px" }}>Μονάδα</th>
            <th style={{ padding: "6px 8px", textAlign: "right" }}>τ.μ.</th>
            <th style={{ padding: "6px 8px", textAlign: "right" }}>Παλιά ‰</th>
            <th style={{ padding: "6px 8px", textAlign: "right" }}>Νέα ‰</th>
          </tr>
        </thead>
        <tbody>
          {units.map((u) => {
            const next = newById[u.id];
            const changed = next != null && next !== u.millesimes;
            return (
              <tr key={u.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ padding: "6px 8px" }}>{u.unitNumber} · {UNIT_TYPE_LABEL[u.unitType] ?? u.unitType}</td>
                <td style={{ padding: "6px 8px", textAlign: "right" }}>{u.areaSqm ?? "—"}</td>
                <td style={{ padding: "6px 8px", textAlign: "right", color: "var(--muted-foreground)" }}>{u.millesimes ?? "—"}</td>
                <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: changed ? 700 : 400, color: next == null ? "var(--muted-foreground)" : changed ? "var(--color-primary)" : "var(--foreground)" }}>
                  {next == null ? "—" : next.toFixed(2)}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: "2px solid var(--border)", fontWeight: 700 }}>
            <td style={{ padding: "6px 8px" }}>Σύνολο</td>
            <td style={{ padding: "6px 8px", textAlign: "right" }}>{totalSqm || "—"}</td>
            <td style={{ padding: "6px 8px" }} />
            <td style={{ padding: "6px 8px", textAlign: "right" }}>{totalNew.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
    </Modal>
  );
}
```

> `cancelBtn`, `saveBtn`, `UNIT_TYPE_LABEL`, `Modal`, `RiLoaderLine`, `RiCheckLine` are all
> already defined/imported in this file (used by the existing modals).

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "CustomerTree" || echo "OK"`
Expected: `OK`.

- [ ] **Step 7: Manual smoke test**

Run: `npm run dev`, open `/super-admin/properties/<id>`, expand a building, open the kebab
(⋮) menu → "Υπολογισμός χιλιοστών". Verify: preview table shows τ.μ. and new ‰ summing to
1000,00; warning appears if a unit lacks τ.μ.; "Εφαρμογή σε όλες" saves and the tree
refreshes with updated ‰.

- [ ] **Step 8: Commit**

```bash
git add "app/(dashboard)/super-admin/customers/CustomerTree.tsx"
git commit -m "feat: add millesimes auto-calc action with preview modal"
```

---

## Self-Review

- **Spec coverage:** calculation rule (Task 2), 2-decimal format + remainder→1000 (Task 2),
  units-without-area warning + no-area error (Tasks 3 & 4), preview modal with old/new ‰ and
  totals (Task 4), dropdown action above Διαγραφή (Task 4), pure function in `lib/` with tests
  (Tasks 1–2), `recalculateMillesimes` action (Task 3). All covered.
- **Placeholders:** none — all code is concrete.
- **Type consistency:** `computeMillesimes(MillesimeInput[]) → MillesimeResult[]` used
  identically in `lib`, the action, and the modal. `recalculateMillesimes` returns
  `{ updated } | { error }`, handled in the modal via the `"error" in res` check.
