# Owner Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dual-role-aware `/owner` dashboard (portfolio cards, owner/tenant KPIs & chart) plus clean owner sidebar via registry regroup + system-role RBAC reconcile.

**Architecture:** Extend `lib/dashboard/owner-queries.ts` with portfolio/tenant-side queries and a pure `duoTrend` helper (TDD); new `DuoBars` SVG chart in `components/dashboard`; rewrite `app/(customer)/owner/page.tsx`; regroup owner modules in `lib/rbac/registry.ts` and add `prisma/reconcile-rbac.ts` to align system-role DB rows with code defaults.

**Tech Stack:** Next.js 16 server components, Prisma 7, Orithon CSS tokens, react-icons/ri, vitest.

**Spec:** `docs/superpowers/specs/2026-07-19-owner-dashboard-redesign-design.md`

Conventions: branch `main`; stage only touched files; commit trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`. Ignore pre-existing failures: vitest `lib/cms/landing-types.test.ts`; tsc `app/actions/auth.ts`, `lib/otp.ts`, `prisma.config.ts`, `prisma/seed.ts`, `app/api/super-admin/costs/*`, `components/forms/ForgotPasswordForm.tsx`.

---

### Task 1: duoTrend helper (TDD) + portfolio/tenant queries

**Files:**
- Modify: `lib/dashboard/alloc-view.ts` (append)
- Test: `lib/dashboard/alloc-view.test.ts` (append)
- Modify: `lib/dashboard/owner-queries.ts` (append)

- [ ] **Step 1: Failing test** — append to `lib/dashboard/alloc-view.test.ts`:

```ts
import { duoTrend } from "./alloc-view"; // merge into the existing import line

describe("duoTrend", () => {
  const months = ["2026-05", "2026-06", "2026-07"];
  it("aligns owner/tenant sums to the month window with zeros", () => {
    const t = duoTrend(
      [
        { month: "2026-07", owner: 30, tenant: 0 },
        { month: "2026-07", owner: 10, tenant: 5 },
        { month: "2026-04", owner: 99, tenant: 99 },
      ],
      months,
    );
    expect(t).toEqual([
      { month: "2026-05", owner: 0, tenant: 0 },
      { month: "2026-06", owner: 0, tenant: 0 },
      { month: "2026-07", owner: 40, tenant: 5 },
    ]);
  });
  it("empty rows → all zero", () => {
    expect(duoTrend([], ["2026-07"])).toEqual([{ month: "2026-07", owner: 0, tenant: 0 }]);
  });
});
```

- [ ] **Step 2:** `npx vitest run lib/dashboard/alloc-view.test.ts` → FAIL (`duoTrend` not exported).
- [ ] **Step 3: Implement** — append to `lib/dashboard/alloc-view.ts`:

```ts
export type DuoPoint = { month: string; owner: number; tenant: number };

/** Sum owner/tenant amounts per month, aligned to `months` (missing → 0). */
export function duoTrend(rows: DuoPoint[], months: string[]): DuoPoint[] {
  const bucket = new Map<string, { owner: number; tenant: number }>(
    months.map((m) => [m, { owner: 0, tenant: 0 }]),
  );
  for (const r of rows) {
    const b = bucket.get(r.month);
    if (b) { b.owner += r.owner; b.tenant += r.tenant; }
  }
  return months.map((m) => ({ month: m, ...bucket.get(m)! }));
}
```

- [ ] **Step 4:** test → PASS.
- [ ] **Step 5: Queries** — append to `lib/dashboard/owner-queries.ts`:

```ts
export type TenancyState = "SELF" | "RENTED" | "VACANT";

export async function getOwnerPortfolio(userId: string) {
  const units = await db.unit.findMany({
    where: { ownerId: userId },
    orderBy: [{ building: { name: "asc" } }, { unitNumber: "asc" }],
    select: {
      id: true, unitNumber: true, floor: true, areaSqm: true, millesimes: true, residentId: true,
      resident: { select: { name: true, email: true } },
      building: { select: { id: true, name: true } },
      allocations: { where: { ownerPaid: false }, select: { ownerAmount: true } },
    },
  });
  return units.map((u) => ({
    id: u.id, unitNumber: u.unitNumber, floor: u.floor, areaSqm: u.areaSqm,
    millesimes: u.millesimes, buildingId: u.building.id, buildingName: u.building.name,
    tenancy: (u.residentId === userId ? "SELF" : u.residentId ? "RENTED" : "VACANT") as TenancyState,
    tenantName: u.residentId && u.residentId !== userId ? (u.resident?.name ?? u.resident?.email ?? null) : null,
    unpaidOwner: u.allocations.reduce((s, a) => s + Number(a.ownerAmount), 0),
  }));
}

export async function getTenantSide(userId: string) {
  const unit = await db.unit.findFirst({
    where: { residentId: userId },
    select: {
      id: true, unitNumber: true,
      building: { select: { name: true } },
      allocations: {
        select: { tenantAmount: true, tenantPaid: true, expense: { select: { month: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!unit) return null;
  const unpaid = unit.allocations.reduce((s, a) => s + (a.tenantPaid ? 0 : Number(a.tenantAmount)), 0);
  return {
    unitNumber: unit.unitNumber, buildingName: unit.building.name,
    unpaidTenant: unpaid, latestMonth: unit.allocations[0]?.expense.month ?? null,
  };
}

export async function getOwnerDuoRows(userId: string) {
  const [ownerAllocs, tenantAllocs] = await Promise.all([
    db.expenseAllocation.findMany({
      where: { unit: { ownerId: userId } },
      select: { ownerAmount: true, expense: { select: { month: true } } },
    }),
    db.expenseAllocation.findMany({
      where: { unit: { residentId: userId } },
      select: { tenantAmount: true, expense: { select: { month: true } } },
    }),
  ]);
  return [
    ...ownerAllocs.map((a) => ({ month: a.expense.month, owner: Number(a.ownerAmount), tenant: 0 })),
    ...tenantAllocs.map((a) => ({ month: a.expense.month, owner: 0, tenant: Number(a.tenantAmount) })),
  ];
}
```
Check the allocation relation name on Unit in prisma/schema.prisma (`allocations`?) — grep `model Unit` and `ExpenseAllocation` relations; adapt select if named differently.

- [ ] **Step 6:** `npx tsc --noEmit 2>&1 | grep -E "alloc-view|owner-queries"` → empty. Commit `feat(owner): portfolio, tenant-side and duo-trend queries`.

---

### Task 2: DuoBars chart

**Files:**
- Create: `components/dashboard/duo-bars.tsx`
- Modify: `components/dashboard/index.ts` (export)

- [ ] **Step 1: Implement** (server-renderable, no hooks):

```tsx
import type { DuoPoint } from "@/lib/dashboard/alloc-view";

const MONTH_ABBR = ["Ιαν","Φεβ","Μαρ","Απρ","Μαϊ","Ιουν","Ιουλ","Αυγ","Σεπ","Οκτ","Νοε","Δεκ"];
const fmt = (n: number) => n.toLocaleString("el-GR", { maximumFractionDigits: 0 });

/** Grouped monthly bars: owner vs tenant charges. Zero months render a baseline dot. */
export function DuoBars({ data, height = 120 }: { data: DuoPoint[]; height?: number }) {
  const max = Math.max(1, ...data.flatMap((d) => [d.owner, d.tenant]));
  const barW = 16, pair = barW * 2 + 4, gap = 22, w = data.length * (pair + gap);
  const label = data.map((d) => `${MONTH_ABBR[Number(d.month.split("-")[1]) - 1]}: ιδιοκτήτης ${fmt(d.owner)}€, ένοικος ${fmt(d.tenant)}€`).join("· ");
  const all0 = data.every((d) => d.owner === 0 && d.tenant === 0);
  if (all0) {
    return <p style={{ margin: 0, fontSize: 13, color: "var(--muted-foreground)" }}>Καμία χρέωση στο εξάμηνο.</p>;
  }
  const bar = (x: number, v: number, color: string) => {
    const h = Math.round((v / max) * height);
    return v === 0
      ? <circle cx={x + barW / 2} cy={height - 2} r={2} fill="var(--border-strong)" />
      : (
        <>
          <rect x={x} y={height - h} width={barW} height={Math.max(3, h)} rx={4} fill={color} />
          <text x={x + barW / 2} y={height - h - 4} textAnchor="middle" fontSize="9" fontWeight={700}
            fill="var(--muted-foreground)" style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(v)}</text>
        </>
      );
  };
  return (
    <div>
      <svg width="100%" viewBox={`-2 -14 ${w} ${height + 34}`} role="img" aria-label={`Χρεώσεις 6μήνου — ${label}`} style={{ display: "block" }}>
        {data.map((d, i) => {
          const x = i * (pair + gap);
          return (
            <g key={d.month}>
              {bar(x, d.owner, "var(--color-primary)")}
              {bar(x + barW + 4, d.tenant, "var(--color-accent)")}
              <text x={x + pair / 2} y={height + 14} textAnchor="middle" fontSize="10" fill="var(--muted-foreground)">
                {MONTH_ABBR[Number(d.month.split("-")[1]) - 1]}
              </text>
            </g>
          );
        })}
      </svg>
      <div style={{ display: "flex", gap: 14, marginTop: 6, fontSize: 11, color: "var(--muted-foreground)" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: "var(--color-primary)" }} /> Ως ιδιοκτήτης
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: "var(--color-accent)" }} /> Ως ένοικος
        </span>
      </div>
    </div>
  );
}
```
Check `--color-accent` exists in globals.css (used by signage); fall back to `#F2A23C`-equivalent token if named differently. Export from `components/dashboard/index.ts` following the existing export style.

- [ ] **Step 2:** `npx tsc --noEmit 2>&1 | grep duo-bars` → empty. Commit `feat(dashboard): DuoBars grouped chart with direct labels`.

---

### Task 3: `/owner` page rewrite

**Files:**
- Rewrite: `app/(customer)/owner/page.tsx`

Read first: current page, `components/dashboard` exports (Hero, StatTile, SectionCard, StatusChip, TicketList, EmptyState), `lib/dashboard/queries.ts` `getOwnerDashboard` (keep using its `tickets` + `owed`; occupancy/gauge/trend replaced), `AutoRefresh` usage. Compose:

1. Data: `getEffectiveSession` → userId; `Promise.all(getOwnerPortfolio, getTenantSide, getOwnerDuoRows, getOwnerDashboard(userId))`; `months = lastNMonths(anchorMonth(), 6)` — `anchorMonth` is not exported from `lib/dashboard/queries.ts`; compute locally: `` const d = new Date(); const anchor = `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}`; `` and import `lastNMonths` from `@/lib/dashboard/aggregations`. `trend = duoTrend(duoRows, months)`.
2. Hero: `Καλησπέρα, {firstName}` · subtitle `X μονάδες σε Y κτήρια` + (tenantSide ? ` · και ένοικος στη μονάδα ${tenantSide.unitNumber}` : "").
3. KPI grid (4 or 3 tiles when no tenantSide): Συνολικές οφειλές `formatEuro(owed + (tenantSide?.unpaidTenant ?? 0))` (warning color when > 0, href `/owner/payments`) · Ως ιδιοκτήτης `formatEuro(owed)` (href `/owner/payments`) · Ως ένοικος `formatEuro(tenantSide.unpaidTenant)` (href `/portal/payments`, only when tenantSide) · Ανοιχτά αιτήματα `tickets.length` (href `/owner/requests`).
4. «Το χαρτοφυλάκιό μου» SectionCard (viewAllHref `/owner/units`): CSS grid `repeat(auto-fill, minmax(240px, 1fr))`; card per unit: top row unit number (16px/700) + tri-state chip (`SELF` → `StatusChip tone="info"` label «Ιδιοκατοίκηση»; `RENTED` → tone success label `Ενοικιασμένο` with tenant name underneath 12px; `VACANT` → tone warning «Κενό» + `border: 1px solid var(--color-warning)` on the card); building name 12px muted; meta line `Όροφος {floor ?? "—"} · {areaSqm ?? "—"} τ.μ. · {millesimes ?? "—"}‰`; bottom row: unpaid € (`tabular-nums`, warning when > 0, «Εξοφλημένο» success text when 0) + two 12px links «Κοινόχρηστα» → `/owner/payments`, «Βλάβη» → `/owner/requests`. Empty state per spec.
5. Right column: SectionCard «Κατάσταση μονάδων» — stacked horizontal bar (flex row of 3 colored segments proportional to rented/self/vacant counts, `--color-primary` / `--color-accent` / `--color-warning`) + legend with counts; hide zero segments. SectionCard «Χρεώσεις 6μήνου» → `<DuoBars data={trend} />`. When tenantSide: SectionCard «Η κατοικία μου (ως ένοικος)» — building+unit, unpaid € big, latest month, link-button «Πληρωμές ενοίκου» → `/portal/payments`.
6. Bottom: «Ανοιχτά αιτήματα συντήρησης» SectionCard (viewAllHref `/owner/requests`) with TicketList; empty state text «Κανένα ανοιχτό αίτημα στα ακίνητά σας» + link «Δήλωση βλάβης» → `/owner/requests`.
7. Keep the page's existing `AutoRefresh` mounts unchanged.

- [ ] **Step 1:** implement per above; Orithon tokens/inline-style idiom of the existing dashboards; Ri Line icons only (RiHome3Line, RiMoneyEuroCircleLine, RiKeyLine, RiToolsLine, RiWallet3Line).
- [ ] **Step 2:** `npx tsc --noEmit 2>&1 | grep "owner/page"` → empty; `npm run build` OK. Commit `feat(owner): dual-role portfolio dashboard`.

---

### Task 4: Sidebar regroup + RBAC reconcile

**Files:**
- Modify: `lib/rbac/registry.ts`
- Modify: `components/admin/sidebar-nav.tsx` (GROUP_META label only if needed)
- Create: `prisma/reconcile-rbac.ts`

- [ ] **Step 1: Registry regroup** — for the customer-surface modules set groups so the OWNER menu collapses to one group: `customer-units`, `customer-income`, `owner-requests`, `owner-announcements` → `group: "assets"`; keep `customer-dashboard` in `core`, `customer-wallet` in `services`. PROPERTY_ADMIN items (`customer-properties`, `customer-maintenance`, `customer-communication`) → also `assets`? NO — admins have their own shell; leave their groups as-is unless already `assets`. Verify `GROUP_META.assets` label is «Τα ακίνητά μου» (update `components/admin/sidebar-nav.tsx` from «Ακίνητά μου» to «Τα ακίνητά μου»).
- [ ] **Step 2: Reconcile script** `prisma/reconcile-rbac.ts` (mirror seed-rbac.ts's imports/bootstrapping):

```ts
import { db } from "../lib/db";
import { DEFAULT_PERMISSIONS } from "../lib/rbac/registry";

/** Align SYSTEM roles' RolePermission rows exactly with the code defaults.
 *  Custom roles are never touched. Idempotent. */
async function main() {
  const roles = await db.role.findMany({ where: { isSystem: true }, select: { id: true, key: true } });
  for (const role of roles) {
    const wanted = new Set(DEFAULT_PERMISSIONS[role.key as keyof typeof DEFAULT_PERMISSIONS] ?? []);
    const existing = await db.rolePermission.findMany({ where: { roleId: role.id } });
    // Field names: check the RolePermission model (grep -n "model RolePermission" -A 10 prisma/schema.prisma)
    // and adapt: rows may store a combined key or (moduleKey, action) pair — build the comparable
    // string the same way lib/rbac stores it (see seed-rbac.ts / permissions.ts permKey usage).
    const have = new Set(existing.map((r) => `${r.moduleKey}:${r.action}`));
    const toDelete = existing.filter((r) => !wanted.has(`${r.moduleKey}:${r.action}`));
    const toInsert = [...wanted].filter((k) => !have.has(k));
    if (toDelete.length) await db.rolePermission.deleteMany({ where: { id: { in: toDelete.map((r) => r.id) } } });
    if (toInsert.length) {
      await db.rolePermission.createMany({
        data: toInsert.map((k) => { const [moduleKey, action] = k.split(":"); return { roleId: role.id, moduleKey, action }; }),
      });
    }
    console.log(`${role.key}: +${toInsert.length} −${toDelete.length}`);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
```
Adapt field names to the real schema (check `Role.isSystem` exists — grep; if the flag is named differently e.g. `system`, adapt; verify how DEFAULT_PERMISSIONS keys map to Role rows — seed-rbac.ts shows it).

- [ ] **Step 3:** Run `npx tsx --env-file=.env prisma/reconcile-rbac.ts` → prints per-role +/− counts; run again → all `+0 −0`.
- [ ] **Step 4:** `npx tsc --noEmit 2>&1 | grep -E "registry|reconcile"` → empty; `npm run build`; `npx vitest run` (only pre-existing failure). Commit `feat(rbac): single owner menu group + system-role reconcile script`.

---

### Task 5: Verification + ship

- [ ] `npx vitest run` / `npx tsc --noEmit` / `npm run build` — green (modulo documented pre-existing).
- [ ] Dev smoke: `/owner` 307-to-login logged out; no 500s.
- [ ] DB spot-check after reconcile: PROPERTY_OWNER role rows == defaults (script idempotence shown).
- [ ] Final review agent on the whole range; fix findings; update memory; push to GitHub main (standing directive).
