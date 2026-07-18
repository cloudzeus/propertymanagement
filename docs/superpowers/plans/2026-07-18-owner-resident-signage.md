# Owner, Resident & Signage Surfaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Functional PROPERTY_OWNER surface (dashboard + 4 sub-pages), completed PROPERTY_RESIDENT portal (payments/files/read-only maintenance), new fullscreen `/signage` surface for PROPERTY_VIEWER, and View-as/demo data fixes across the customer surface.

**Architecture:** All customer pages resolve the user via `getEffectiveSession()` (View-as works). New `lib/dashboard/owner-queries.ts` and `lib/signage/data.ts` hold the queries; pages stay thin server components reusing `components/dashboard` primitives. Signage is its own route group with a fullscreen dark layout, a client `SignageBoard` for clock/rotation/refresh, and Open-Meteo for weather (no key).

**Tech Stack:** Next.js 16 App Router, Prisma 7, Auth.js v5 + lib/auth-effective, Tailwind 4/Orithon CSS vars, react-icons/ri, vitest.

**Spec:** `docs/superpowers/specs/2026-07-18-owner-resident-signage-design.md`

Conventions for every task: work on `main`; the tree has unrelated uncommitted changes — `git add` only files you touched, never `-A`. Pre-existing failures to ignore: vitest `lib/cms/landing-types.test.ts`; tsc errors in `app/actions/auth.ts`, `lib/otp.ts`, `prisma.config.ts`, `prisma/seed.ts`, `app/api/super-admin/costs/*`, `components/forms/ForgotPasswordForm.tsx`.

---

### Task 1: Month-grouping helper + owner queries

**Files:**
- Create: `lib/dashboard/alloc-view.ts` (pure, testable)
- Test: `lib/dashboard/alloc-view.test.ts`
- Create: `lib/dashboard/owner-queries.ts`

- [ ] **Step 1: Failing test** `lib/dashboard/alloc-view.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { groupAllocationsByMonth, type AllocRow } from "./alloc-view";

const rows: AllocRow[] = [
  { id: "a", month: "2026-07", unitLabel: "A1", description: "Κοινόχρηστα", amount: 40, paid: false, receiptUrl: null },
  { id: "b", month: "2026-07", unitLabel: "B2", description: null, amount: 10, paid: true, receiptUrl: null },
  { id: "c", month: "2026-06", unitLabel: "A1", description: null, amount: 25, paid: true, receiptUrl: "u" },
];

describe("groupAllocationsByMonth", () => {
  it("groups by month desc with per-month and grand totals", () => {
    const g = groupAllocationsByMonth(rows);
    expect(g.months.map((m) => m.month)).toEqual(["2026-07", "2026-06"]);
    expect(g.months[0].total).toBe(50);
    expect(g.months[0].unpaid).toBe(40);
    expect(g.totalUnpaid).toBe(40);
    expect(g.total).toBe(75);
  });
  it("handles empty input", () => {
    const g = groupAllocationsByMonth([]);
    expect(g.months).toEqual([]);
    expect(g.total).toBe(0);
    expect(g.totalUnpaid).toBe(0);
  });
});
```

- [ ] **Step 2:** `npx vitest run lib/dashboard/alloc-view.test.ts` → FAIL (module missing).
- [ ] **Step 3:** Implement `lib/dashboard/alloc-view.ts`:

```ts
/** Row shape shared by owner/resident payment pages. */
export type AllocRow = {
  id: string; month: string; unitLabel: string; description: string | null;
  amount: number; paid: boolean; receiptUrl: string | null;
};

export type MonthGroup = { month: string; rows: AllocRow[]; total: number; unpaid: number };

export function groupAllocationsByMonth(rows: AllocRow[]): {
  months: MonthGroup[]; total: number; totalUnpaid: number;
} {
  const byMonth = new Map<string, MonthGroup>();
  for (const r of rows) {
    let g = byMonth.get(r.month);
    if (!g) { g = { month: r.month, rows: [], total: 0, unpaid: 0 }; byMonth.set(r.month, g); }
    g.rows.push(r);
    g.total += r.amount;
    if (!r.paid) g.unpaid += r.amount;
  }
  const months = [...byMonth.values()].sort((a, b) => b.month.localeCompare(a.month));
  return {
    months,
    total: months.reduce((s, m) => s + m.total, 0),
    totalUnpaid: months.reduce((s, m) => s + m.unpaid, 0),
  };
}
```

- [ ] **Step 4:** test → PASS.
- [ ] **Step 5:** Create `lib/dashboard/owner-queries.ts` (server module, no "use server") exporting, all strictly `ownerId = userId`:

```ts
import { db } from "@/lib/db";
import { type AllocRow } from "./alloc-view";

export async function getOwnerUnits(userId: string) {
  return db.unit.findMany({
    where: { ownerId: userId },
    orderBy: [{ building: { name: "asc" } }, { unitNumber: "asc" }],
    select: {
      id: true, unitNumber: true, unitType: true, floor: true, areaSqm: true, millesimes: true,
      residentId: true,
      resident: { select: { name: true, email: true } },
      building: { select: { id: true, name: true, address: true, city: true } },
      occupancies: {
        orderBy: { startDate: "desc" },
        select: { id: true, role: true, startDate: true, endDate: true, user: { select: { name: true, email: true } } },
      },
    },
  });
}

export async function getOwnerAllocRows(userId: string): Promise<AllocRow[]> {
  const allocs = await db.expenseAllocation.findMany({
    where: { unit: { ownerId: userId } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, ownerAmount: true, ownerPaid: true,
      unit: { select: { unitNumber: true, building: { select: { name: true } } } },
      expense: { select: { month: true, description: true, receiptFile: { select: { url: true } } } },
    },
  });
  return allocs.map((a) => ({
    id: a.id, month: a.expense.month,
    unitLabel: `${a.unit.building.name} · ${a.unit.unitNumber}`,
    description: a.expense.description,
    amount: Number(a.ownerAmount), paid: a.ownerPaid,
    receiptUrl: a.expense.receiptFile?.url ?? null,
  }));
}

export async function getOwnerBuildingIds(userId: string): Promise<string[]> {
  const units = await db.unit.findMany({ where: { ownerId: userId }, select: { buildingId: true } });
  return [...new Set(units.map((u) => u.buildingId))];
}

export const PUBLIC_FILE_CATEGORIES = ["PLANS", "PHOTOS", "DOCUMENTS", "CERTIFICATES", "OTHER"] as const;

export async function getOwnerAnnouncementsAndFiles(userId: string) {
  const buildingIds = await getOwnerBuildingIds(userId);
  const [announcements, files] = await Promise.all([
    db.announcement.findMany({
      where: { buildingId: { in: buildingIds }, status: "ACTIVE", audience: { in: ["ALL", "OWNERS"] } },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, content: true, imageUrl: true, createdAt: true, building: { select: { name: true } } },
    }),
    db.buildingFile.findMany({
      where: { buildingId: { in: buildingIds }, category: { in: [...PUBLIC_FILE_CATEGORIES] } },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, url: true, category: true, mimeType: true, sizeBytes: true, createdAt: true, building: { select: { name: true } } },
    }),
  ]);
  return { announcements, files };
}

export async function getOwnerRequests(userId: string) {
  return db.maintenanceRequest.findMany({
    where: { unit: { ownerId: userId } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, title: true, status: true, priority: true, createdAt: true,
      unit: { select: { unitNumber: true } }, building: { select: { name: true } },
      categoryRef: { select: { name: true } },
    },
  });
}
```
Check field names against `prisma/schema.prisma` (`expense.receiptFile` relation exists on BuildingExpense as `receiptFile`; verify with grep — adapt select if the relation is named differently, e.g. via `receiptFileId`). Also verify `Announcement.audience` values ("ALL"/"OWNERS"/"RESIDENTS").

- [ ] **Step 6:** `npx tsc --noEmit 2>&1 | grep -E "owner-queries|alloc-view"` → empty. Commit:
```bash
git add lib/dashboard/alloc-view.ts lib/dashboard/alloc-view.test.ts lib/dashboard/owner-queries.ts
git commit -m "feat(owner): allocation view helper + owner dashboard queries"
```

---

### Task 2: Owner pages

**Files:**
- Modify: `app/(customer)/owner/page.tsx` (effective session + links)
- Create: `app/(customer)/owner/units/page.tsx`
- Create: `app/(customer)/owner/payments/page.tsx`
- Create: `app/(customer)/owner/requests/page.tsx`
- Create: `app/(customer)/owner/announcements/page.tsx`

All pages: server components; resolve user via
```ts
const eff = await getEffectiveSession();
if (!eff?.user?.id) redirect("/login");
const userId = eff.user.id as string;
```
(`getEffectiveSession` from `@/lib/auth-effective` — read `app/(customer)/portal/requests/page.tsx` for the exact idiom used there, including any permission call; owner pages must NOT call `requirePermission("customer-requests", ...)` — check `lib/rbac` registry for owner-appropriate permission keys; if none exists for these pages, rely on the surface layout role guard + per-query userId scoping, matching how `/owner` works today).

- [ ] **Step 1:** `/owner` page: replace `auth()` with effective session; `StatTile` hrefs → `/owner/units`, `/owner/payments`, `/owner/requests`; "Οι μονάδες μου" viewAllHref `/owner/units`; maintenance SectionCard viewAllHref `/owner/requests`.
- [ ] **Step 2:** `/owner/units`: `getOwnerUnits`; render section cards per building; table rows: μονάδα, όροφος, τ.μ., χιλιοστά, κατάσταση (`StatusChip` Ενοικιασμένο/Κενό), τρέχων ένοικος; expandable `<details>` per unit with occupancy history (role Ιδιοκτήτης/Ένοικος, από/έως dates el-GR, user name/email). Empty state via `EmptyState`.
- [ ] **Step 3:** `/owner/payments`: `getOwnerAllocRows` → `groupAllocationsByMonth`; top `StatTile` row (Σύνολο οφειλών = totalUnpaid, Σύνολο χρεώσεων = total); month sections with `MoneyRow` per row (paid flag), receipt link icon when `receiptUrl`; months collapsed except latest (`<details open>` for first).
- [ ] **Step 4:** `/owner/requests`: `getOwnerRequests` list (status chip via `lib/maintenance-shared` STATUS_LABELS/STATUS_COLORS, priority, unit/building/category/date, row links to `/portal/requests/[id]`); `NewRequestButton` from `@/components/maintenance/new-request-form` with the owner's buildings+units (build from `getOwnerUnits` result) and `detailBase="/portal/requests"`; categories via `db.maintenanceCategory.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } })` (same as portal requests page).
- [ ] **Step 5:** `/owner/announcements`: `getOwnerAnnouncementsAndFiles`; announcements cards (title, building, date, imageUrl when present, content rendered like `app/(customer)/portal/announcements/page.tsx` renders it — read it first and reuse the idiom); files list grouped by building (icon by mimeType, size KB/MB, download link `target="_blank"`).
- [ ] **Step 6:** `npx tsc --noEmit 2>&1 | grep "owner/"` → empty; `npm run build` OK. Commit:
```bash
git add "app/(customer)/owner"
git commit -m "feat(owner): functional owner surface — units, payments, requests, announcements"
```

---

### Task 3: Resident portal completion

**Files:**
- Modify: `app/(customer)/portal/page.tsx` (effective session; wallet link check)
- Modify: `app/(customer)/portal/announcements/page.tsx`, `app/(customer)/portal/wallet/page.tsx` (effective session where they read auth())
- Create: `app/(customer)/portal/payments/page.tsx`
- Create: `app/(customer)/portal/files/page.tsx`
- Rewrite: `app/(customer)/portal/maintenance/page.tsx` (read-only)

- [ ] **Step 1:** Sweep `app/(customer)/portal/**` for `auth()` usage (`grep -rn "await auth()" "app/(customer)"`) and replace with the effective-session idiom (keep `getResidentDashboard(userId, companyId)` args working — companyId from `eff.user` if present).
- [ ] **Step 2:** `/portal/payments`: same structure as owner payments but tenant-side: query `expenseAllocation.findMany({ where: { unit: { residentId: userId } }, ... })` mapping `tenantAmount/tenantPaid`, unitLabel from unit+building, receipt via `expense.receiptFile`; reuse `groupAllocationsByMonth` + the same UI idiom (extract shared presentational bits ONLY if trivially — a small `PaymentsView` component in `components/dashboard/payments-view.tsx` taking `{ rows: AllocRow[]; title: string }` is the right call; both owner and portal payments pages render `<PaymentsView …/>`).
- [ ] **Step 3:** `/portal/files`: resident's buildingIds (units where `residentId = userId` OR open occupancy `occupancies: { some: { userId, endDate: null } }`), files filtered to `PUBLIC_FILE_CATEGORIES` (import from `lib/dashboard/owner-queries`), same list UI as owner files (share a small `FilesList` component in `components/dashboard/files-list.tsx` used by both pages).
- [ ] **Step 4:** `/portal/maintenance` rewrite: drop CalendarPanel/MaintenanceTab imports entirely. New read-only page: resident's buildingIds → `db.recurringTask.findMany({ where: { buildingId: { in: ids }, active: true }, orderBy: { nextDueDate: "asc" } })` (Επερχόμενες συντηρήσεις: title, frequency label, nextDueDate, vendor) + `listMaintenanceHistory`-style completed log (query `db.maintenanceLog.findMany` — check the model/fields in schema first; if the maintenance history is only reachable via the action `listMaintenanceHistory(buildingId)` which now requires building view access residents don't have, query `db.maintenanceLog` directly here scoped to the resident's buildingIds). No buttons, no mutations.
- [ ] **Step 5:** `npx tsc --noEmit 2>&1 | grep "portal/"` → empty; `npm run build`. Commit:
```bash
git add "app/(customer)/portal" components/dashboard/payments-view.tsx components/dashboard/files-list.tsx
git commit -m "feat(portal): resident payments + files pages, read-only maintenance, effective session"
```

---

### Task 4: Signage surface

**Files:**
- Modify: `lib/surfaces.ts` (PROPERTY_VIEWER → "/signage") + `lib/surfaces.test.ts` (expect "/signage")
- Create: `lib/signage/data.ts`
- Create: `app/(signage)/layout.tsx`
- Create: `app/(signage)/signage/page.tsx`
- Create: `components/signage/SignageBoard.tsx`

- [ ] **Step 1:** Update `lib/surfaces.test.ts` expectation to `/signage`, run → FAIL; change `lib/surfaces.ts` HOME_BY_ROLE `PROPERTY_VIEWER: "/signage"`, run → PASS. Grep for other references to viewer home (`grep -rn '"/portal"' lib app | grep -i viewer`).
- [ ] **Step 2:** `lib/signage/data.ts`:

```ts
import { db } from "@/lib/db";

export async function viewerBuildingIds(userId: string): Promise<string[]> {
  const assignments = await db.managementAssignment.findMany({
    where: { userId }, select: { buildingId: true, propertyId: true },
  });
  const direct = assignments.map((a) => a.buildingId).filter((x): x is string => !!x);
  const propertyIds = assignments.map((a) => a.propertyId).filter((x): x is string => !!x);
  const viaProperty = propertyIds.length
    ? (await db.building.findMany({ where: { propertyId: { in: propertyIds } }, select: { id: true } })).map((b) => b.id)
    : [];
  return [...new Set([...direct, ...viaProperty])];
}

export async function getSignageData(buildingId: string) {
  const month = `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, "0")}`;
  const [building, announcements, tasks, assembly, allocs, contacts] = await Promise.all([
    db.building.findUnique({ where: { id: buildingId }, select: { id: true, name: true, address: true, city: true, lat: true, lng: true } }),
    db.announcement.findMany({
      where: { buildingId, status: "ACTIVE" },
      orderBy: { createdAt: "desc" }, take: 10,
      select: { id: true, title: true, content: true, imageUrl: true, createdAt: true },
    }),
    db.recurringTask.findMany({
      where: { buildingId, active: true, nextDueDate: { gte: new Date() } },
      orderBy: { nextDueDate: "asc" }, take: 5,
      select: { id: true, title: true, nextDueDate: true, vendor: true },
    }),
    db.assembly.findFirst({
      where: { buildingId, status: "SCHEDULED", scheduledAt: { gte: new Date() } },
      orderBy: { scheduledAt: "asc" },
      select: { id: true, title: true, scheduledAt: true },
    }),
    db.expenseAllocation.findMany({
      where: { unit: { buildingId }, expense: { month } },
      select: { tenantAmount: true, tenantPaid: true, ownerAmount: true, ownerPaid: true },
    }),
    db.contact.findMany({ where: { buildingId }, orderBy: { name: "asc" }, select: { id: true, name: true, category: true, phone: true } }),
  ]);
  if (!building) return null;
  let total = 0, collected = 0;
  for (const a of allocs) {
    const t = Number(a.tenantAmount), o = Number(a.ownerAmount);
    total += t + o;
    collected += (a.tenantPaid ? t : 0) + (a.ownerPaid ? o : 0);
  }
  return {
    building,
    announcements: announcements.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
    tasks: tasks.map((t) => ({ ...t, nextDueDate: t.nextDueDate ? t.nextDueDate.toISOString() : null })),
    assembly: assembly ? { ...assembly, scheduledAt: assembly.scheduledAt.toISOString() } : null,
    collection: { pct: total > 0 ? Math.round((collected / total) * 100) : null },
    contacts,
  };
}

export type SignageData = NonNullable<Awaited<ReturnType<typeof getSignageData>>>;

const WEATHER_LABELS: Record<number, string> = {
  0: "Αίθριος", 1: "Κυρίως αίθριος", 2: "Λίγα σύννεφα", 3: "Συννεφιά",
  45: "Ομίχλη", 48: "Ομίχλη", 51: "Ψιχάλα", 53: "Ψιχάλα", 55: "Ψιχάλα",
  61: "Βροχή", 63: "Βροχή", 65: "Έντονη βροχή", 71: "Χιόνι", 73: "Χιόνι", 75: "Χιόνι",
  80: "Μπόρες", 81: "Μπόρες", 82: "Ισχυρές μπόρες", 95: "Καταιγίδα", 96: "Καταιγίδα", 99: "Καταιγίδα",
};

export async function getWeather(lat: number | null, lng: number | null): Promise<{ temp: number; label: string } | null> {
  if (lat == null || lng == null) return null;
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code`,
      { next: { revalidate: 1800 } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const temp = data?.current?.temperature_2m;
    const code = data?.current?.weather_code;
    if (typeof temp !== "number") return null;
    return { temp: Math.round(temp), label: WEATHER_LABELS[code] ?? "" };
  } catch { return null; }
}
```

- [ ] **Step 3:** `app/(signage)/layout.tsx` — minimal, NO AppShell:

```tsx
export default function SignageLayout({ children }: { children: React.ReactNode }) {
  return <div style={{ minHeight: "100vh", background: "#141210", color: "#F5F1E8" }}>{children}</div>;
}
```
(Confirm the Orithon dark canvas/foreground hexes from `app/globals.css` tokens — use the closest existing dark values instead of inventing new ones.)

- [ ] **Step 4:** `app/(signage)/signage/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getEffectiveSession } from "@/lib/auth-effective";
import { homePathForRole } from "@/lib/surfaces";
import { viewerBuildingIds, getSignageData, getWeather } from "@/lib/signage/data";
import { SignageBoard } from "@/components/signage/SignageBoard";
import type { UserRole } from "@/lib/prisma/enums";

export const metadata = { title: "Πίνακας κτηρίου" };
const STAFF = ["SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE"];

export default async function SignagePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const eff = await getEffectiveSession();
  if (!eff?.user?.id) redirect("/login");
  const role = (eff.user as { role?: string }).role ?? "";
  const userId = eff.user.id as string;

  const requested = typeof sp.building === "string" ? sp.building : null;
  let buildingId: string | null = null;
  if (STAFF.includes(role)) {
    buildingId = requested; // staff preview must name a building
    if (!buildingId) redirect(homePathForRole(role as UserRole));
  } else if (role === "PROPERTY_VIEWER") {
    const ids = await viewerBuildingIds(userId);
    buildingId = requested && ids.includes(requested) ? requested : ids[0] ?? null;
  } else {
    redirect(homePathForRole(role as UserRole));
  }

  const data = buildingId ? await getSignageData(buildingId) : null;
  if (!data) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, opacity: 0.7 }}>
        Δεν έχει οριστεί κτήριο για αυτή την οθόνη.
      </div>
    );
  }
  const weather = await getWeather(data.building.lat, data.building.lng);
  return <SignageBoard data={data} weather={weather} />;
}
```
(Check how `getEffectiveSession` exposes role — read `lib/auth-effective.ts` and adapt the role read; check Building has `lat`/`lng` fields in schema — they exist per PostGIS/geodata work; if named differently adapt.)

- [ ] **Step 5:** `components/signage/SignageBoard.tsx` ("use client"). Props `{ data: SignageData; weather: { temp: number; label: string } | null }`. Behavior:
  - `useEffect` interval 1000ms → clock state (`toLocaleTimeString("el-GR", { hour: "2-digit", minute: "2-digit" })`, date `toLocaleDateString("el-GR", { weekday: "long", day: "numeric", month: "long" })`).
  - Announcement rotation: `idx` advances every 12000ms mod announcements.length; dot indicators.
  - `useEffect` interval 60000ms → `router.refresh()`.
  - Layout (CSS grid, min-height 100vh, padding 48, gap 32, font sizes ~2× dashboard):
    - Header row: building name (40px/800) + address · right: weather (`{temp}°C {label}`) + clock (56px/800) + date.
    - Main grid `2fr 1fr`: left = rotating announcement card (title 34px, content rendered as HTML — announcements store rich HTML; use `dangerouslySetInnerHTML` inside a container with capped height and `overflow: hidden`, imageUrl on top when present); right column stacked cards: Επερχόμενες συντηρήσεις (title+date+vendor), Επόμενη συνέλευση (title + full date/time), Εισπράξεις μήνα (big % — render only when `collection.pct !== null`).
    - Footer: horizontal contact strip — each contact `name · category · phone`, phone big/bold; if >4 contacts marquee-scroll via CSS animation, else static row.
  - No links, no buttons, `cursor: none` on the root.
- [ ] **Step 6:** `npx vitest run lib/surfaces.test.ts` PASS; `npx tsc --noEmit 2>&1 | grep -E "signage"` → empty; `npm run build` (routes include `/signage`). Commit:
```bash
git add lib/surfaces.ts lib/surfaces.test.ts lib/signage components/signage "app/(signage)"
git commit -m "feat(signage): fullscreen building board for PROPERTY_VIEWER"
```

---

### Task 5: Demo viewer seed + View-as verification

**Files:**
- Create: `prisma/seed-demo-viewer.ts`

- [ ] **Step 1:** Script (idempotent; follow the style of `prisma/seed-rbac.ts` for db import/bootstrapping):

```ts
import { db } from "../lib/db";

async function main() {
  const email = "signage-demo@dgsmart.gr";
  const existing = await db.user.findUnique({ where: { email } });
  const building = await db.building.findFirst({
    where: { property: { managed: true } },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, property: { select: { customerId: true } } },
  });
  if (!building) { console.log("No managed building found — aborting."); return; }
  const user = existing ?? await db.user.create({
    data: {
      email, name: "Οθόνη Εισόδου (Demo)", role: "PROPERTY_VIEWER",
      status: "ACTIVE", customerId: building.property.customerId,
    },
  });
  const has = await db.managementAssignment.findFirst({ where: { userId: user.id, buildingId: building.id } });
  if (!has) await db.managementAssignment.create({ data: { userId: user.id, buildingId: building.id } });
  console.log(`Viewer ${email} → ${building.name}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
```
Check `User` required fields (password nullable? status enum values) in schema and adapt (no password → login only via View-as, which is the point). Check `ManagementAssignment` required fields (e.g. `assignedById`?) and satisfy them.

- [ ] **Step 2:** Run `npx tsx --env-file=.env prisma/seed-demo-viewer.ts` → prints assignment line. Re-run → idempotent.
- [ ] **Step 3:** DB spot-check all four demo roles now have data paths: run a small tsx script printing per-role counts (owner units, resident units/occupancies, admin assignments, viewer assignments) — all non-zero.
- [ ] **Step 4:** `npm run build` + `npx vitest run` (only pre-existing failures). Commit:
```bash
git add prisma/seed-demo-viewer.ts
git commit -m "feat(seed): demo PROPERTY_VIEWER account wired to a managed building"
```

---

### Task 6: End-to-end verification

- [ ] `npx vitest run`; `npx tsc --noEmit` (only the known pre-existing errors); `npm run build`.
- [ ] Dev-server smoke: `/owner`, `/owner/units`, `/owner/payments`, `/owner/requests`, `/owner/announcements`, `/portal/payments`, `/portal/files`, `/portal/maintenance`, `/signage` all → 307 to login when logged out; no 500s.
- [ ] `npx prisma migrate diff --from-config-datasource prisma.config.ts --to-schema prisma/schema.prisma --script` → empty (no schema change).
- [ ] Final review of full range, then report.
