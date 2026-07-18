# Manager Building Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fully functional, capability-scoped building dashboard for PROPERTY_ADMIN at `/building/[id]`, sharing the 19 staff panels via `components/building/` with a new grouped-navigation shell.

**Architecture:** A central access layer (`lib/building-access.ts`) derives a `BuildingCaps` object from role + `ManagementAssignment` + `property.managed`. The staff page's query pipeline moves to `lib/building/dashboard-data.ts` and feeds both surfaces. Panels move to `components/building/` and take a `can` prop; server actions are hardened with `requireBuildingCap`.

**Tech Stack:** Next.js 16 App Router (server components), Prisma 7, Auth.js v5, Tailwind 4 tokens (Orithon), react-icons/ri, vitest.

**Spec:** `docs/superpowers/specs/2026-07-18-manager-building-dashboard-design.md`

---

### Task 1: Capability model + access layer

**Files:**
- Create: `lib/building-access.ts`
- Create: `lib/building-caps.ts` (pure, testable — no server imports)
- Test: `lib/building-caps.test.ts`

- [ ] **Step 1: Write the failing test** (`lib/building-caps.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import { capsForStaff, capsForManager, NO_CAPS } from "./building-caps";

describe("capsForManager", () => {
  it("managed building: view-heavy, communication CRUD, request creation", () => {
    const c = capsForManager(true);
    expect(c.editUnits).toBe(false);
    expect(c.editMillesimes).toBe(false);
    expect(c.manageExpenses).toBe(false);
    expect(c.manageKoinochrista).toBe(false);
    expect(c.managePayments).toBe(false);
    expect(c.manageInfra).toBe(false);
    expect(c.manageManagedItems).toBe(false);
    expect(c.manageMaintenance).toBe(false);
    expect(c.manageFiles).toBe(true);
    expect(c.manageContacts).toBe(true);
    expect(c.manageAnnouncements).toBe(true);
    expect(c.manageAssemblies).toBe(true);
    expect(c.manageCalendar).toBe(true);
    expect(c.createRequests).toBe(true);
    expect(c.editDistribution).toBe(false);
    expect(c.viewAudit).toBe(true);
    expect(c.manageManagers).toBe(false);
  });
  it("self-managed building: full CRUD except distribution settings and managers", () => {
    const c = capsForManager(false);
    expect(c.editUnits).toBe(true);
    expect(c.editMillesimes).toBe(true);
    expect(c.manageExpenses).toBe(true);
    expect(c.manageKoinochrista).toBe(true);
    expect(c.managePayments).toBe(true);
    expect(c.manageInfra).toBe(true);
    expect(c.manageManagedItems).toBe(true);
    expect(c.manageMaintenance).toBe(true);
    expect(c.editDistribution).toBe(false);
    expect(c.manageManagers).toBe(false);
  });
  it("staff gets everything; NO_CAPS gets nothing", () => {
    expect(Object.values(capsForStaff()).every(Boolean)).toBe(true);
    expect(Object.values(NO_CAPS).every((v) => v === false)).toBe(true);
  });
});
```

- [ ] **Step 2: Run** `npx vitest run lib/building-caps.test.ts` — expect FAIL (module missing).

- [ ] **Step 3: Implement** `lib/building-caps.ts`

```ts
/** Capability flags for one building, as seen by the current viewer. */
export type BuildingCaps = {
  editUnits: boolean; editMillesimes: boolean; editDistribution: boolean;
  manageExpenses: boolean; manageKoinochrista: boolean; managePayments: boolean;
  manageFiles: boolean; manageContacts: boolean; manageAnnouncements: boolean;
  manageAssemblies: boolean; manageCalendar: boolean; manageInfra: boolean;
  manageManagedItems: boolean; manageMaintenance: boolean; createRequests: boolean;
  viewAudit: boolean; manageManagers: boolean;
};

const all = (v: boolean): BuildingCaps => ({
  editUnits: v, editMillesimes: v, editDistribution: v,
  manageExpenses: v, manageKoinochrista: v, managePayments: v,
  manageFiles: v, manageContacts: v, manageAnnouncements: v,
  manageAssemblies: v, manageCalendar: v, manageInfra: v,
  manageManagedItems: v, manageMaintenance: v, createRequests: v,
  viewAudit: v, manageManagers: v,
});

export const NO_CAPS: BuildingCaps = all(false);

export function capsForStaff(): BuildingCaps {
  return all(true);
}

/** PROPERTY_ADMIN caps. `managed` = the company manages the building (property.managed). */
export function capsForManager(managed: boolean): BuildingCaps {
  return {
    ...all(!managed),
    // Communication + own requests are always allowed:
    manageFiles: true, manageContacts: true, manageAnnouncements: true,
    manageAssemblies: true, manageCalendar: true, createRequests: true, viewAudit: true,
    // Company-owned settings are never manager-editable:
    editDistribution: false, manageManagers: false,
  };
}
```

- [ ] **Step 4: Run** `npx vitest run lib/building-caps.test.ts` — expect PASS.

- [ ] **Step 5: Implement** `lib/building-access.ts` (server-side resolution + action guard)

```ts
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { type BuildingCaps, capsForStaff, capsForManager } from "@/lib/building-caps";

export type BuildingAccess = {
  viewer: "staff" | "manager";
  managed: boolean;
  can: BuildingCaps;
};

const STAFF_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER"] as const;

/** Resolve what `userId` may do on `buildingId`. Null → no access (render 404). */
export async function getBuildingAccess(userId: string, buildingId: string): Promise<BuildingAccess | null> {
  const [user, building] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { role: true } }),
    db.building.findUnique({
      where: { id: buildingId },
      select: { propertyId: true, property: { select: { managed: true } } },
    }),
  ]);
  if (!user || !building) return null;
  const managed = building.property.managed;

  if ((STAFF_ROLES as readonly string[]).includes(user.role)) {
    return { viewer: "staff", managed, can: capsForStaff() };
  }
  if (user.role !== "PROPERTY_ADMIN") return null;

  const assignment = await db.managementAssignment.findFirst({
    where: { userId, OR: [{ buildingId }, { propertyId: building.propertyId }] },
    select: { id: true },
  });
  if (!assignment) return null;
  return { viewer: "manager", managed, can: capsForManager(managed) };
}

/** Guard for server actions: throws unless the session user holds `cap` on the building. */
export async function requireBuildingCap(buildingId: string, cap: keyof BuildingCaps): Promise<{ userId: string; access: BuildingAccess }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const access = await getBuildingAccess(session.user.id as string, buildingId);
  if (!access || !access.can[cap]) throw new Error("Forbidden");
  return { userId: session.user.id as string, access };
}

/** All building IDs a PROPERTY_ADMIN reaches via ManagementAssignment (direct or property-wide). */
export async function managerBuildingIds(userId: string): Promise<string[]> {
  const assignments = await db.managementAssignment.findMany({
    where: { userId },
    select: { buildingId: true, propertyId: true },
  });
  const direct = assignments.map((a) => a.buildingId).filter((x): x is string => !!x);
  const propertyIds = assignments.map((a) => a.propertyId).filter((x): x is string => !!x);
  const viaProperty = propertyIds.length
    ? (await db.building.findMany({ where: { propertyId: { in: propertyIds } }, select: { id: true } })).map((b) => b.id)
    : [];
  return Array.from(new Set([...direct, ...viaProperty]));
}
```

- [ ] **Step 6: Verify + commit**

Run: `npx tsc --noEmit` → no new errors.
```bash
git add lib/building-caps.ts lib/building-caps.test.ts lib/building-access.ts
git commit -m "feat(building): capability model + access layer for building dashboards"
```

---

### Task 2: Extract the shared data loader

**Files:**
- Create: `lib/building/dashboard-data.ts`
- Modify: `app/(company)/super-admin/buildings/[id]/page.tsx`

- [ ] **Step 1:** Move everything in `app/(company)/super-admin/buildings/[id]/page.tsx` between the `db.building.findUnique` call (line ~20) and the final JSX into an exported function in `lib/building/dashboard-data.ts`:

```ts
// lib/building/dashboard-data.ts
// (imports: db, listBuildingExpenses, getBuildingCategorySplits, listHeatingReadings, listMaintenanceHistory)

export type BuildingDashboardData = Awaited<ReturnType<typeof getBuildingDashboardData>> & {};

export async function getBuildingDashboardData(id: string, opts: { heatingPeriod?: string | null } = {}) {
  // …verbatim body of the current page.tsx queries (building, millesimesSum, files, people map,
  // contacts/infra/tasks/managedItems, expenses, heating, meter readings, overview,
  // maintenanceHistory)…
  if (!building) return null;
  return {
    building: { /* same mapped shape the JSX passes today */ },
    kpis, units, files, people, contacts, managedItems, managedItemTypes,
    infraPoints: infra, floorOptions, tasks, expenses, categorySplits,
    millesimeUnits, exclusionUnits, expenseCategories, categoryOverrides, unitExclusions,
    usesMeteredHeating, heatingPeriod, heatingReadingRows, meterReadingRows,
    overview, maintenanceHistory, today: new Date().toISOString(),
  };
}
```

The move is verbatim — no logic changes. The `heatingPeriod` searchParam handling moves in too (`opts.heatingPeriod` replaces `resolvedSearchParams.heatingPeriod`).

- [ ] **Step 2:** Rewrite the staff page to:

```tsx
const data = await getBuildingDashboardData(id, { heatingPeriod: rawHeatingPeriod });
if (!data) notFound();
return <BuildingDashboard {...data} />;
```
keeping the existing SUPER_ADMIN redirect guard.

- [ ] **Step 3: Verify + commit**

Run: `npx tsc --noEmit` and `npm run build` → success.
```bash
git add lib/building/dashboard-data.ts "app/(company)/super-admin/buildings/[id]/page.tsx"
git commit -m "refactor(building): extract dashboard data loader for reuse"
```

---

### Task 3: Move panels to `components/building/`

**Files:**
- Move (git mv, keep filenames): all of `app/(company)/super-admin/buildings/[id]/{AnnouncementsPanel,AssembliesPanel,AuditDrawer,CalendarPanel,ContactsPanel,DistributionTab,ExclusionMatrix,FilesPanel,HeatingReadingsPanel,InfraPanel,MaintenanceTab,ManagedItemsPanel,ManagersPanel,MeterReadingsPanel,MillesimeGrid,PeoplePanel,UnitsPanel}.tsx` → `components/building/`
- Modify: `app/(company)/super-admin/buildings/[id]/BuildingDashboard.tsx` (imports `./X` → `@/components/building/X`)
- Modify: any other importers (`grep -rn "buildings/\[id\]/" app components --include='*.tsx' -l`)

- [ ] **Step 1:** `git mv` the 17 files; update relative imports inside them (`./FilesPanel` etc. still resolve since they move together; fix any `../` imports).
- [ ] **Step 2:** Update `BuildingDashboard.tsx` imports; grep for remaining references:
`grep -rn '"\./\(FilesPanel\|UnitsPanel\)' app | grep -v components` → empty.
- [ ] **Step 3:** `npx tsc --noEmit` + `npm run build` → success. Commit `refactor(building): move panels to components/building`.

---

### Task 4: `can` prop on panels

**Files:** every panel in `components/building/` + `components/buildings/{ExpensesPanel,KoinochristaPanel,CategorySplitSettings}.tsx`, and `BuildingDashboard.tsx`.

Pattern — each panel accepts `can?: BuildingCaps` (import type from `@/lib/building-caps`) defaulting to nothing-hidden **only via explicit staff pass-through**; the staff shell passes `can={capsForStaff()}` and the manager shell its resolved caps. Gate:

| Panel | Cap gating mutation UI |
|---|---|
| UnitsPanel (add/edit unit, occupant assign) | `can.editUnits` |
| MillesimeGrid, HeatingReadingsPanel | `can.editMillesimes` |
| DistributionTab, ExclusionMatrix, CategorySplitSettings | `can.editDistribution` |
| ExpensesPanel (upload/OCR/edit/delete) | `can.manageExpenses` |
| KoinochristaPanel (issue/edit) | `can.manageKoinochrista`; mark-paid buttons `can.managePayments` |
| FilesPanel upload/delete | `can.manageFiles` |
| ContactsPanel CRUD | `can.manageContacts` |
| AnnouncementsPanel CRUD | `can.manageAnnouncements` |
| AssembliesPanel create/edit/minutes | `can.manageAssemblies` |
| CalendarPanel task CRUD | `can.manageCalendar` |
| InfraPanel CRUD | `can.manageInfra` |
| ManagedItemsPanel CRUD | `can.manageManagedItems` |
| MaintenanceTab (log/complete) | `can.manageMaintenance`; "Νέο αίτημα" button `can.createRequests` |
| MeterReadingsPanel, PeoplePanel | read-only already — no prop |
| ManagersPanel | staff-only; not rendered on manager surface |
| AuditDrawer | rendered when `can.viewAudit` |

- [ ] **Step 1:** Add the prop + conditional rendering of every create/edit/delete button and inline form per the table (hide, don't disable, when cap is false).
- [ ] **Step 2:** `BuildingDashboard.tsx`: accept `can: BuildingCaps`, forward to each panel; staff page passes `capsForStaff()`.
- [ ] **Step 3:** `npx tsc --noEmit` + `npm run build`; visually spot-check staff dashboard unchanged. Commit `feat(building): capability-gated panel mutations`.

---

### Task 5: Harden server actions with `requireBuildingCap`

**Files → capability (replace `requireStaff`/role-only checks; resolve `buildingId` from the record for id-based mutations before guarding):**

| Action file | Cap |
|---|---|
| `app/actions/contacts.ts` | `manageContacts` |
| `app/actions/building-files.ts` | `manageFiles` |
| `app/actions/announcements.ts` (building-scoped ones) | `manageAnnouncements` |
| `app/actions/assemblies.ts` | `manageAssemblies` |
| `app/actions/recurring-tasks.ts` | `manageCalendar` |
| `app/actions/maintenance-logs.ts` | `manageMaintenance` |
| `app/actions/maintenance-requests.ts` (create) | `createRequests` |
| `app/actions/infra-points.ts` | `manageInfra` |
| `app/actions/managed-items.ts` | `manageManagedItems` |
| `app/actions/building-millesimes.ts`, `heating-readings.ts` | `editMillesimes` |
| `app/actions/unit-occupants.ts`, unit CRUD in `buildings.ts` | `editUnits` |
| `app/actions/koinochrista.ts` (issue/edit) | `manageKoinochrista`; mark-paid → `managePayments` |
| `app/actions/building-expenses.ts` | swap `canManageBuildingExpenses` internals to `requireBuildingCap(id, "manageExpenses")` |
| `app/actions/expense-categories.ts` (building overrides) | `editDistribution` |
| `app/actions/building-audit.ts` (read) | `viewAudit` |
| `app/actions/managers.ts` | keep staff-only (`manageManagers`) |

Guard pattern (example, `contacts.ts`):

```ts
import { requireBuildingCap } from "@/lib/building-access";

export async function createContact(buildingId: string, data: ContactInput) {
  await requireBuildingCap(buildingId, "manageContacts");
  // …unchanged body…
  revalidatePath(`/super-admin/buildings/${buildingId}`);
  revalidatePath(`/building/${buildingId}`);
  return { contact: row };
}

export async function updateContact(id: string, data: Partial<ContactInput>) {
  const existing = await db.contact.findUnique({ where: { id }, select: { buildingId: true } });
  if (!existing) return { error: "Δεν βρέθηκε" };
  await requireBuildingCap(existing.buildingId, "manageContacts");
  // …unchanged body…
}
```

- [ ] **Step 1:** Apply per file (guard first, then existing body; add `revalidatePath("/building/${buildingId}")` next to every existing super-admin revalidate).
- [ ] **Step 2:** Data-isolation fix: any user-search/selector action reachable from these panels (e.g. occupant `UserCombo` search in `unit-occupants.ts`/`users.ts`) must, for `viewer === "manager"`, filter to users of the building's own customer — never global.
- [ ] **Step 3:** `npx tsc --noEmit` + `npm run build`. Commit `feat(building): building-scoped authorization on all building actions`.

---

### Task 6: Manager routes

**Files:**
- Rewrite: `app/(customer)/building/page.tsx`
- Create: `app/(customer)/building/[id]/page.tsx`

- [ ] **Step 1:** `/building` — resolve `managerBuildingIds(userId)`. `0` → friendly empty state; `1` → `redirect(\`/building/${ids[0]}\`)`; many → cards grid (name, address, Managed badge, units count, month collection % via `getBuildingManagerDashboard`-style aggregates, unpaid €, open requests) each linking to `/building/[id]`.
- [ ] **Step 2:** `/building/[id]`:

```tsx
import { auth } from "@/auth";
import { notFound, redirect } from "next/navigation";
import { getBuildingAccess, managerBuildingIds } from "@/lib/building-access";
import { getBuildingDashboardData } from "@/lib/building/dashboard-data";
import { BuildingManagerShell } from "@/components/building/manager-shell/BuildingManagerShell";

export const metadata = { title: "Το κτήριό μου" };

export default async function ManagerBuildingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id as string;
  const access = await getBuildingAccess(userId, id);
  if (!access) notFound();

  const heatingPeriod = typeof sp.heatingPeriod === "string" ? sp.heatingPeriod : null;
  const [data, siblingIds] = await Promise.all([
    getBuildingDashboardData(id, { heatingPeriod }),
    access.viewer === "manager" ? managerBuildingIds(userId) : Promise.resolve([id]),
  ]);
  if (!data) notFound();
  const siblings = await db.building.findMany({ where: { id: { in: siblingIds } }, select: { id: true, name: true }, orderBy: { name: "asc" } });

  return <BuildingManagerShell {...data} can={access.can} viewer={access.viewer} siblings={siblings} />;
}
```

- [ ] **Step 3:** `npx tsc --noEmit`. Commit `feat(manager): building routes with access resolution`.

---

### Task 7: BuildingManagerShell — grouped navigation + actionable overview

**Files:**
- Create: `components/building/manager-shell/BuildingManagerShell.tsx`
- Create: `components/building/manager-shell/ManagerOverview.tsx`
- Create: `components/building/manager-shell/sections.ts`

- [ ] **Step 1:** `sections.ts` — the 6-section map (filter items by caps/flags at render):

```ts
import type { BuildingCaps } from "@/lib/building-caps";
export type SectionKey = "overview" | "finance" | "building" | "people" | "maintenance" | "communication";
export type SubTab = { key: string; label: string; visible?: (can: BuildingCaps, f: { managed: boolean; metered: boolean }) => boolean };
export const SECTIONS: { key: SectionKey; label: string; tabs: SubTab[] }[] = [
  { key: "overview", label: "Επισκόπηση", tabs: [] },
  { key: "finance", label: "Οικονομικά", tabs: [
    { key: "koino", label: "Κοινόχρηστα" }, { key: "expenses", label: "Έξοδα" },
    { key: "pay", label: "Πληρωμές" }, { key: "readings", label: "Ενδείξεις μετρητών" },
  ]},
  { key: "building", label: "Κτήριο", tabs: [
    { key: "units", label: "Μονάδες" }, { key: "millesimes", label: "Χιλιοστά & Κατανομή" },
    { key: "splitsettings", label: "Ρυθμίσεις κατανομής" }, { key: "infra", label: "Εγκαταστάσεις" },
    { key: "manageditems", label: "Διαχειριζόμενα στοιχεία", visible: (_c, f) => f.managed },
  ]},
  { key: "people", label: "Άνθρωποι", tabs: [
    { key: "people", label: "Ένοικοι & Ιδιοκτήτες" }, { key: "contacts", label: "Επαφές" },
  ]},
  { key: "maintenance", label: "Συντήρηση", tabs: [
    { key: "maint", label: "Αιτήματα βλαβών" }, { key: "maintenance", label: "Συντηρήσεις" },
    { key: "calendar", label: "Ημερολόγιο" },
  ]},
  { key: "communication", label: "Επικοινωνία", tabs: [
    { key: "ann", label: "Ανακοινώσεις" }, { key: "assemblies", label: "Συνελεύσεις" },
    { key: "files", label: "Αρχεία" },
  ]},
];
```

- [ ] **Step 2:** `BuildingManagerShell.tsx` (client) — props = `BuildingDashboardData & { can; viewer; siblings }`. Layout: hero (name, address chips, `ManagedBadge`, building switcher `<select>` → `router.push(/building/${id})` when `siblings.length > 1`, AuditDrawer when `can.viewAudit`), horizontal **section** bar (6 pills with Ri icons), **sub-tab** row underneath, URL state via `useSearchParams` (`?s=finance&t=expenses`, `router.replace` on change). Panel switch statement reuses exactly the same panel JSX as `BuildingDashboard.tsx` (same props + `can`). Overview renders `ManagerOverview`.
- [ ] **Step 3:** `ManagerOverview.tsx` — server-data driven, no new queries: collections gauge (`overview.paid/unpaid`, reuse `Gauge` from `components/dashboard`), debtors count, KPI strip (units/millesimes/files/contacts), open requests list, upcoming maintenance, latest announcements teaser, and quick-action buttons filtered by caps (Νέα ανακοίνωση → communication/ann, Νέο αίτημα βλάβης → maintenance/maint, Νέο έξοδο → finance/expenses, Ανέβασμα αρχείου → communication/files). Orithon tokens, Ri Line icons only.
- [ ] **Step 4:** `npx tsc --noEmit` + `npm run build`. Commit `feat(manager): grouped-navigation building shell with actionable overview`.

---

### Task 8: End-to-end verification

- [ ] `npm run test` (vitest) — all green.
- [ ] `npx tsc --noEmit` && `npm run build` — clean.
- [ ] `npx prisma migrate diff --from-config-datasource prisma.config.ts --to-schema prisma/schema.prisma --script` → empty (no schema change).
- [ ] Manual (dev server + View-as PROPERTY_ADMIN): single-building auto-redirect; multi-building cards + switcher; managed building hides expense/unit mutations but allows announcement CRUD; self-managed shows full CRUD; foreign buildingId in URL → 404; staff dashboard unchanged.
- [ ] Commit any fixes; final commit `feat(manager): functional building dashboard for property managers`.
