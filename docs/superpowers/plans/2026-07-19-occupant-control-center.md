# Occupant Control Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Read-only, super-admin-grade building control center at `/building/[id]` for owners/residents: ειδοποιητήριο statement (screen+print), expenses w/ receipt modal, photo gallery, assembly decisions, documents/contacts/announcements.

**Architecture:** `getBuildingAccess` gains an `occupant` viewer (NO_CAPS + createRequests). A new `lib/building/occupant-data.ts` computes the notice-style statement from `BuildingExpense`+`ExpenseAllocation`+category bases (pure `buildStatement` helper, TDD). New `components/building/occupant-shell/` renders 8 sections with `?s=` URL state and a print stylesheet for the statement.

**Tech Stack:** Next.js 16 server components + client shell, Prisma 7, Orithon tokens, react-icons/ri, vitest.

**Spec:** `docs/superpowers/specs/2026-07-19-occupant-control-center-design.md`

Conventions: branch `main`; stage only touched files; trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`. Ignore pre-existing failures: vitest `lib/cms/landing-types.test.ts`; tsc `app/actions/auth.ts`, `lib/otp.ts`, `prisma.config.ts`, `prisma/seed.ts`, `app/api/super-admin/costs/*`, `components/forms/ForgotPasswordForm.tsx`.

Schema facts (verified): `DistributionBasis = GENERAL_MILLESIMES | ELEVATOR_MILLESIMES | HEATING_MILLESIMES | EQUAL_PER_UNIT | METERED_70_30`; `ExpenseCategory.defaultBasis`; `BuildingCategoryOverride{buildingId,categoryId,distributionBasis}`; `BuildingExpense{month, issuedMonth, categoryId→categoryRef, tenantPct, ownerPct, amount, receiptFile, supplierName, documentNumber, documentDate, netAmount, vatAmount, paid, status}`; `ExpenseAllocation{expenseId, unitId, unitShare, tenantAmount/tenantPaid, ownerAmount/ownerPaid}`; `Unit{millesimes, millesimesElevator, millesimesHeating, ownerId, residentId, occupancies}`. No shared Lightbox component exists — build a small one in the shell.

---

### Task 1: Occupant access (TDD-adjacent) + proxy + index fallback

**Files:**
- Modify: `lib/building-caps.ts` (+`OCCUPANT_CAPS`), `lib/building-caps.test.ts`
- Modify: `lib/building-access.ts`
- Modify: `proxy.ts` (role list ONLY)
- Modify: `app/(customer)/building/page.tsx` (occupant fallback)

- [ ] **Step 1:** Test first — append to `lib/building-caps.test.ts`:

```ts
import { OCCUPANT_CAPS } from "./building-caps"; // merge into existing import

describe("OCCUPANT_CAPS", () => {
  it("is read-only except request creation", () => {
    expect(OCCUPANT_CAPS.createRequests).toBe(true);
    const { createRequests: _cr, ...rest } = OCCUPANT_CAPS;
    expect(Object.values(rest).every((v) => v === false)).toBe(true);
  });
});
```
Run → FAIL. Implement in `lib/building-caps.ts`:

```ts
/** Owners/residents inside their own building: view everything public, mutate nothing. */
export const OCCUPANT_CAPS: BuildingCaps = { ...NO_CAPS, createRequests: true };
```
Run → PASS.

- [ ] **Step 2:** `lib/building-access.ts` — extend `getBuildingAccess`: `BuildingAccess.viewer` type becomes `"staff" | "manager" | "occupant"`. After the PROPERTY_ADMIN manager check fails (and for roles PROPERTY_OWNER/PROPERTY_RESIDENT — also let a PROPERTY_ADMIN without assignment fall through to occupant if they own/rent there):

```ts
const unit = await db.unit.findFirst({
  where: {
    buildingId,
    OR: [{ ownerId: userId }, { residentId: userId }, { occupancies: { some: { userId, endDate: null } } }],
  },
  select: { id: true },
});
if (unit) return { viewer: "occupant", managed, can: OCCUPANT_CAPS };
return null;
```
(Structure: staff → manager (PROPERTY_ADMIN w/ assignment) → occupant (any customer role w/ unit) → null.)

- [ ] **Step 3:** `proxy.ts` — add `PROPERTY_OWNER`, `PROPERTY_RESIDENT` to the `/building` prefix allowlist if one exists (grep; the earlier review said `/building` has NO proxy gate — if so, no change; verify and note).
- [ ] **Step 4:** `/building` index page: when `managerBuildingIds` is empty, fall back to occupant buildings:

```ts
const units = await db.unit.findMany({
  where: { OR: [{ ownerId: userId }, { residentId: userId }, { occupancies: { some: { userId, endDate: null } } }] },
  select: { buildingId: true },
});
const ids = [...new Set(units.map((u) => u.buildingId))];
```
1 → redirect; many → reuse the cards grid but WITHOUT collection/unpaid stats for occupants (name, address, ManagedBadge, units count); 0 → existing empty state.

- [ ] **Step 5:** `npx vitest run lib/building-caps.test.ts` PASS; `npx tsc --noEmit 2>&1 | grep -E "building-access|building-caps|\(customer\)/building"` empty. Commit `feat(building): occupant viewer access for owners and residents`.

---

### Task 2: Statement math (TDD) + occupant data loader

**Files:**
- Create: `lib/building/statement.ts` (pure) + `lib/building/statement.test.ts`
- Create: `lib/building/occupant-data.ts`

- [ ] **Step 1: Failing tests** `lib/building/statement.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildStatement, groupForBasis, type StatementExpense } from "./statement";

const exp = (over: Partial<StatementExpense>): StatementExpense => ({
  id: "e1", categoryName: "Καθαριότητα", basis: "GENERAL_MILLESIMES",
  amount: 100, tenantPct: 100, ownerPct: 0, myShare: 10, myTenant: 10, myOwner: 0, ...over,
});

describe("groupForBasis", () => {
  it("maps bases to the classic groups", () => {
    expect(groupForBasis("GENERAL_MILLESIMES", 100)).toBe("A");
    expect(groupForBasis("ELEVATOR_MILLESIMES", 100)).toBe("B");
    expect(groupForBasis("HEATING_MILLESIMES", 100)).toBe("C");
    expect(groupForBasis("METERED_70_30", 100)).toBe("C");
    expect(groupForBasis("EQUAL_PER_UNIT", 100)).toBe("D");
    expect(groupForBasis("GENERAL_MILLESIMES", 0)).toBe("E"); // tenantPct 0 → owners-only
  });
});

describe("buildStatement", () => {
  it("groups expenses, sums group totals and my amounts", () => {
    const s = buildStatement([
      exp({ id: "a", amount: 60, myShare: 6 }),
      exp({ id: "b", categoryName: "ΔΕΗ", amount: 40, myShare: 4 }),
      exp({ id: "c", categoryName: "Συντήρηση ασανσέρ", basis: "ELEVATOR_MILLESIMES", amount: 50, myShare: 2, myTenant: 2, myOwner: 0 }),
      exp({ id: "d", categoryName: "Ανακαίνιση", basis: "GENERAL_MILLESIMES", tenantPct: 0, ownerPct: 100, amount: 200, myShare: 20, myTenant: 0, myOwner: 20 }),
    ]);
    const a = s.groups.find((g) => g.key === "A")!;
    expect(a.total).toBe(100);
    expect(a.lines.length).toBe(2);
    expect(a.myTotal).toBe(10);
    expect(s.groups.find((g) => g.key === "B")!.total).toBe(50);
    expect(s.groups.find((g) => g.key === "E")!.myTotal).toBe(20);
    expect(s.total).toBe(350);
    expect(s.myTotal).toBe(32);
    expect(s.myTenant).toBe(12);
    expect(s.myOwner).toBe(20);
  });
  it("omits empty groups", () => {
    expect(buildStatement([exp({})]).groups.map((g) => g.key)).toEqual(["A"]);
  });
});
```

- [ ] **Step 2:** Run → FAIL. Implement `lib/building/statement.ts`:

```ts
export type StatementBasis = "GENERAL_MILLESIMES" | "ELEVATOR_MILLESIMES" | "HEATING_MILLESIMES" | "EQUAL_PER_UNIT" | "METERED_70_30";
export type StatementGroupKey = "A" | "B" | "C" | "D" | "E";

export const GROUP_LABELS: Record<StatementGroupKey, string> = {
  A: "Α. ΚΟΙΝΟΧΡΗΣΤΑ", B: "Β. ΑΝΕΛΚΥΣΤΗΡΑΣ", C: "Γ. ΘΕΡΜΑΝΣΗ",
  D: "Δ. ΛΟΙΠΑ ΕΞΟΔΑ", E: "Ε. ΕΞΟΔΑ ΣΥΝΙΔΙΟΚΤΗΣΙΑΣ",
};

export type StatementExpense = {
  id: string; categoryName: string; basis: StatementBasis;
  amount: number; tenantPct: number; ownerPct: number;
  myShare: number; myTenant: number; myOwner: number;
};

export type StatementGroup = {
  key: StatementGroupKey; label: string; total: number; myTotal: number;
  lines: { id: string; categoryName: string; amount: number; myShare: number }[];
};

export function groupForBasis(basis: StatementBasis, tenantPct: number): StatementGroupKey {
  if (tenantPct === 0) return "E"; // owners-only expense, regardless of distribution basis
  if (basis === "ELEVATOR_MILLESIMES") return "B";
  if (basis === "HEATING_MILLESIMES" || basis === "METERED_70_30") return "C";
  if (basis === "EQUAL_PER_UNIT") return "D";
  return "A";
}

export function buildStatement(rows: StatementExpense[]) {
  const order: StatementGroupKey[] = ["A", "B", "C", "D", "E"];
  const groups = new Map<StatementGroupKey, StatementGroup>();
  let total = 0, myTotal = 0, myTenant = 0, myOwner = 0;
  for (const r of rows) {
    const key = groupForBasis(r.basis, r.tenantPct);
    let g = groups.get(key);
    if (!g) { g = { key, label: GROUP_LABELS[key], total: 0, myTotal: 0, lines: [] }; groups.set(key, g); }
    g.total += r.amount;
    g.myTotal += r.myShare;
    g.lines.push({ id: r.id, categoryName: r.categoryName, amount: r.amount, myShare: r.myShare });
    total += r.amount; myTotal += r.myShare; myTenant += r.myTenant; myOwner += r.myOwner;
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    groups: order.filter((k) => groups.has(k)).map((k) => {
      const g = groups.get(k)!;
      return { ...g, total: round(g.total), myTotal: round(g.myTotal) };
    }),
    total: round(total), myTotal: round(myTotal), myTenant: round(myTenant), myOwner: round(myOwner),
  };
}
```

- [ ] **Step 3:** Run → PASS.
- [ ] **Step 4:** `lib/building/occupant-data.ts` — `getOccupantControlCenter(buildingId, userId, opts: { month?: string | null })` per the spec's data list. Key mechanics:
  - `myUnits`: user's units in the building (owner/resident/open-occupancy) with `millesimes/millesimesElevator/millesimesHeating`, rel labels.
  - `months`: `db.buildingExpense.findMany({ where: { buildingId }, select: { issuedMonth: true, month: true } })` → distinct `issuedMonth ?? month` desc; `selectedMonth = opts.month valid ? : months[0] ?? current`.
  - Basis resolution: fetch categories + building overrides once; `basisOf(exp) = override?.distributionBasis ?? exp.categoryRef?.defaultBasis ?? "GENERAL_MILLESIMES"`.
  - `statementRows`: expenses of the month (`issuedMonth ?? month === selectedMonth`, status CONFIRMED — check enum) with their allocations for the user's unitIds → map to `StatementExpense` (`myShare` = sum of `unitShare` over my units; `myTenant/myOwner` from tenantAmount/ownerAmount but ONLY for allocations where the corresponding side is me: tenant side counts when `unit.residentId === userId` (or open occupancy RESIDENT), owner side when `unit.ownerId === userId`) → `buildStatement`.
  - `paidState`: for my allocations of the month → whether each side is paid.
  - `expenses`: month expenses full fields + `receipt: { url, mimeType, name } | null`.
  - `gallery`: `db.infraPoint.findMany({ where: { buildingId }, select: { name, floorLabel, media: { where: { type: "IMAGE" } , select: { id, url } } } })` (check media type enum) + `db.buildingFile.findMany({ where: { buildingId, category: "PHOTOS" } })`.
  - `assemblies`: all for building desc `scheduledAt`, select id/title/scheduledAt/status/minutesFinal (only when status APPROVED/SENT — check `AssemblyStatus` values; if statuses differ, include minutesFinal when non-null and approvedAt set) + files category MINUTES if that category exists (it does NOT — schema has no MINUTES; use DOCUMENTS? → just skip file attachment, minutesFinal HTML is the decision record; note deviation).
  - `files`: PUBLIC_FILE_CATEGORIES (import from `@/lib/dashboard/owner-queries`).
  - `contacts`; `announcements` audience by relationship (owner→["ALL","OWNERS"], resident→["ALL","RESIDENTS"], both→all three).
  - All dates → ISO strings; Decimals → Number.

- [ ] **Step 5:** `npx tsc --noEmit 2>&1 | grep -E "statement|occupant-data"` → empty. Commit `feat(building): occupant statement math + control-center data loader`.

---

### Task 3: Occupant shell — sections, statement view, expense modal, print

**Files:**
- Create: `components/building/occupant-shell/OccupantBuildingShell.tsx`
- Create: `components/building/occupant-shell/StatementView.tsx`
- Create: `components/building/occupant-shell/ExpensesSection.tsx` (+ modal)
- Create: `components/building/occupant-shell/GallerySection.tsx` (+ lightbox)
- Create: `components/building/occupant-shell/AssembliesSection.tsx` (+ minutes modal)
- Modify: `app/globals.css` (print rules)

Read first for idiom parity: `components/building/manager-shell/BuildingManagerShell.tsx` (pills, URL state, hero), `components/buildings/ExpensesPanel.tsx` (row/menu idiom), `components/dashboard/files-list.tsx`, `components/support/*` or `DemoBookingModal` for the portal-based modal idiom (`createPortal` to body, overlay, ESC/backdrop close).

- [x] **Step 1: Shell** — client component, props = full occupant data + `{ myUnitLabels: string[] }`. Hero (building name, ManagedBadge, chips address · «Η μονάδα μου: X» per unit). Section pills (`?s=`, router.replace): overview/koino/expenses/gallery/assemblies/files/contacts/ann — labels: Επισκόπηση, Κοινόχρηστα, Έξοδα, Χώροι & Φωτογραφίες, Συνελεύσεις, Έγγραφα, Επαφές, Ανακοινώσεις. Icons: RiDashboardLine, RiWallet3Line, RiMoneyEuroCircleLine, RiImageLine, RiGroupLine, RiFolderLine, RiContactsBook3Line, RiMegaphoneLine. `<AutoRefresh buildingId>`. Overview: my-unit cards (χιλιοστά triple), current-month tile (Το μερίδιό μου: X€ · paid badge), latest announcement teaser, next assembly, quick actions (Δήλωση βλάβης → `/portal/requests` or `/owner/requests` by role prop; Ειδοποιητήριο → koino).
- [x] **Step 2: StatementView** — month `<select>` (router.replace `?s=koino&month=`); header strip like the classic notice (ΠΟΛΥΚΑΤΟΙΚΙΑ / ΜΗΝΑΣ / my unit); groups Α-Ε as bordered tables: rows category+amount+my-share (my column highlighted `background: var(--color-primary)08`), group subtotal row; footer: ΣΥΝΟΛΟ ΔΑΠΑΝΩΝ, my totals split (Ενοίκου/Ιδιοκτήτη), ΠΛΗΡΩΤΕΟ ΠΟΣΟ big + paid badge; χιλιοστά line per my unit (Κανονικά/Ανελκυστήρα/Θέρμανσης). All money `tabular-nums`, right-aligned. «Εκτύπωση» button → `window.print()`. Wrap in `<div className="statement-print-root">`.
- [x] **Step 3: Print CSS** — append to `app/globals.css`:

```css
@media print {
  body * { visibility: hidden; }
  .statement-print-root, .statement-print-root * { visibility: visible; }
  .statement-print-root { position: absolute; inset: 0; padding: 0; background: #fff; color: #000; }
  .statement-print-root .no-print { display: none !important; }
}
```
Month picker + print button get `className="no-print"`.
- [x] **Step 4: ExpensesSection** — table (Ημ/νία, Κατηγορία, Προμηθευτής, Παραστατικό, Ποσό, Πληρωμή badge); row click → modal (createPortal): two-column entry fields (καθαρό/ΦΠΑ/σύνολο, tenantPct/ownerPct, description) + receipt pane: `<img>` for image mime, `<iframe>` for application/pdf (height 480), else download link; footer close + «Λήψη» link. ESC/backdrop close, no body scroll while open.
- [x] **Step 5: GallerySection** — groups by infra point (title + floor chip) then «Φωτογραφίες κτηρίου» from files; thumbnails grid 160px; click → lightbox modal (portal, dark overlay, arrows ←/→ within group, ESC). **AssembliesSection** — rows (date el-GR, title, StatusChip-style badge for status); when minutesFinal → button «Αποφάσεις» → modal rendering the HTML (`dangerouslySetInnerHTML`, scrollable, print not needed). Files/Contacts/Announcements sections reuse `FilesList` + card idioms from the owner pages.
- [x] **Step 6:** `npx tsc --noEmit 2>&1 | grep occupant-shell` → empty. Commit `feat(building): occupant control-center shell with notice statement and receipt modals`.

---

### Task 4: Routing + entry points + menu

**Files:**
- Modify: `app/(customer)/building/[id]/page.tsx`
- Modify: `app/(customer)/owner/page.tsx` (+`/owner/units` card links), `app/(customer)/portal/page.tsx`
- Modify: `lib/rbac/registry.ts` (+ run reconcile)

- [ ] **Step 1:** `[id]/page.tsx`: after access resolution — `if (access.viewer === "occupant") { const data = await getOccupantControlCenter(id, userId, { month }); return <OccupantBuildingShell {...data} viewerRole={eff role} managed={access.managed} />; }` (month from `searchParams.month`). Manager/staff path untouched.
- [ ] **Step 2:** Entry points: owner portfolio cards + «Η κατοικία μου» card → `<Link href={`/building/${buildingId}`}>` on building name («Το κτήριό μου →» link in card footer); portal dashboard hero aside button «Το κτήριό μου» → `/building/${unit.buildingId}` when unit exists.
- [ ] **Step 3:** Registry: add module `{ key: "occupant-building", label: "Το κτήριό μου", surface: "customer", menu: { href: "/building", icon: "RiBuildingLine", group: "assets" }, actions: [...VIEW] }`; grant `view` in DEFAULT_PERMISSIONS to PROPERTY_OWNER and PROPERTY_RESIDENT. Run `npx tsx --env-file=.env prisma/reconcile-rbac.ts` (report counts; second run +0 −0).
- [ ] **Step 4:** `npx tsc --noEmit` filtered clean; `npm run build`; `npx vitest run` (only pre-existing failure). Commit `feat(building): occupant routing, entry points and menu`.

---

### Task 5: Verification + ship

- [ ] Full runs: vitest / tsc / build — green modulo documented.
- [ ] Smoke: `/building/<fake>` logged-out 307; no 500s on build routes.
- [ ] Final holistic review agent (access precedence staff>manager>occupant, statement math vs a real month in DB for Λυδία, no mutation leakage in occupant shell, print CSS scoped, modals accessible incl. ESC/backdrop, menu entries).
- [ ] Update memory; push to GitHub main (standing directive).
