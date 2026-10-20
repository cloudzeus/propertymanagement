# Company menu reorganisation + Work center — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give ADMIN/MANAGER/EMPLOYEE a sidebar with a fixed workflow order and a `/admin/work` page that unifies every pending company task (faults, work orders, RFQs, maintenance programme, appointments) with KPIs, filters, inline fault assignment/status and an "Οι εργασίες μου" view.

**Architecture:** Menu groups become data (`MENU_GROUPS` in the RBAC registry) that `buildMenu` orders and the sidebar renders; module keys and URLs do not change. The work center is a read-only view-model layer (`lib/work/*`: pure normalizers + KPI/filter functions, one server loader) over existing Prisma models, rendered by a server page + a client `DataTable`, with inline mutations delegated to the existing `assignRequest`/`changeRequestStatus` actions. A company-wide SSE channel refreshes the page; an AI read tool reuses the same loader.

**Tech Stack:** Next.js 16.2 (App Router, server components), Prisma 7/PostgreSQL (no schema change), Auth.js v5 effective session, Tailwind 4.1 + inline style tokens, shadcn-style `components/ui/data-table.tsx`, react-icons/ri `*Line`, Vitest.

**Spec:** [docs/superpowers/specs/2026-10-20-company-menu-work-center-design.md](../specs/2026-10-20-company-menu-work-center-design.md)

## Global Constraints

- No URL and no RBAC module key changes; new module key is exactly `work` with href `/admin/work`, actions `["view"]`.
- Greek UI copy everywhere; font sizes only via `var(--fs-*)`; icons only `react-icons/ri` `*Line` (and `*Fill` for the active sidebar state).
- Every page under `app/(company)` that reads data is a server component; guards via `requirePermission(moduleKey, action)` from `@/lib/rbac/permissions`.
- No Prisma migration, no `prisma migrate dev`. The local `DATABASE_URL` is production: no test rows, no notification-triggering action (assign / status change) during verification.
- Group order (fixed): overview → customers → operations → suppliers → communication → financials → settings → softone → cms → help. `settings`, `softone`, `cms` start collapsed.
- Pure modules (`lib/work/types.ts`, `normalize.ts`, `kpis.ts`, `lib/rbac/*-core`) must not import `server-only`, `next/*` or `@/lib/db`.
- Read `node_modules/next/dist/docs/` for any App Router API you are unsure of before writing code.
- Commit after every task with the attribution line `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Never push.

## Review Focus

1. A role whose DB `RolePermission` rows predate this change (no `work:view`, EMPLOYEE without `dashboard:view`) must still get a valid menu; `buildMenu` must not throw on a module with no group entry. → Task 1 test "unknown group falls to the end".
2. A `MaintenanceRequest` with `slaDueAt = null` or a `WorkOrder` with neither `scheduledAt` nor `validUntil` must produce `dueAt: null`, `overdue: false`, and be excluded from the today/week KPIs but still listed. → Task 4 and Task 5 tests.
3. MANAGER with account-managed customers must see only those customers' buildings in `/admin/work`; MANAGER with none sees everything (same rule as `/admin/maintenance`). → Task 6 test of `customerIdsForScope`.
4. URL filters with garbage values (`?f=xyz&source=nope&priority=LOW,FOO`) must not crash: unknown values are dropped. → Task 5 test "parseFilters ignores unknown values".
5. Inline assignment select must only appear for `source === "fault"` and for viewers with `canAssign`; EMPLOYEE must never get the select even if the table is shared. → Task 8 manual check + Task 6 `viewerFor` test.

---

### Task 1: Menu groups as data + ordered `buildMenu` + role-aware Dashboard

**Files:**
- Modify: `lib/rbac/registry.ts` (company modules block, `DEFAULT_PERMISSIONS`)
- Modify: `lib/rbac/types.ts`
- Modify: `lib/rbac/permissions-core.ts`
- Test: `lib/rbac/permissions.test.ts`, `lib/rbac/registry.test.ts`

**Interfaces:**
- Produces in `lib/rbac/types.ts`:
  ```ts
  export interface MenuGroupDef { id: string; label: string; icon: string; color: string; defaultOpen: boolean; }
  ```
- Produces in `lib/rbac/registry.ts`: `export const MENU_GROUPS: readonly MenuGroupDef[]` (order = display order) and the module `{ key: "work", label: "Κέντρο εργασιών", surface: "company", menu: { href: "/admin/work", icon: "RiTaskLine", group: "overview" }, actions: ["view"] }`.
- Produces in `lib/rbac/permissions-core.ts`:
  ```ts
  export interface MenuGroup { id: string; label: string; icon: string; color: string; defaultOpen: boolean; items: MenuItem[]; }
  export function buildMenu(surface: Surface, perms: Set<string>, role?: UserRole): MenuGroup[]
  ```
  Groups sorted by index in `MENU_GROUPS`; ids absent from `MENU_GROUPS` go last in first-seen order with `label = id`, `icon = "RiFileListLine"`, `color = "#5C5C5C"`, `defaultOpen = true`. Company `dashboard` href = `homePathForRole(role)` when `role` is given.

- [ ] **Step 1: Write the failing tests** in `lib/rbac/permissions.test.ts` (append to `describe("buildMenu()")`):

```ts
it("orders company groups overview → customers → operations → … → help and collapses settings/softone/cms", () => {
  const perms = new Set(["help:view", "settings:view", "cms-landing:view", "maintenance:view", "customers:view", "dashboard:view", "billing:view", "softone-sync:view", "announcements:view", "suppliers:view"]);
  const menu = buildMenu("company", perms, "ADMIN");
  expect(menu.map((g) => g.id)).toEqual(["overview", "customers", "operations", "suppliers", "communication", "financials", "settings", "softone", "cms", "help"]);
  expect(menu.find((g) => g.id === "settings")!.defaultOpen).toBe(false);
  expect(menu.find((g) => g.id === "cms")!.defaultOpen).toBe(false);
  expect(menu.find((g) => g.id === "operations")!.defaultOpen).toBe(true);
  expect(menu.find((g) => g.id === "customers")!.label).toBe("Πελάτες & Ακίνητα");
});
it("points the company Dashboard at each role's home", () => {
  const perms = new Set(["dashboard:view"]);
  expect(buildMenu("company", perms, "ADMIN")[0].items[0].href).toBe("/admin");
  expect(buildMenu("company", perms, "MANAGER")[0].items[0].href).toBe("/manager");
  expect(buildMenu("company", perms, "EMPLOYEE")[0].items[0].href).toBe("/staff");
  expect(buildMenu("company", perms, "SUPER_ADMIN")[0].items[0].label).toBe("Αρχική");
});
it("puts the work center in overview right after the home", () => {
  const items = buildMenu("company", new Set(["dashboard:view", "work:view", "reports:view"]), "ADMIN")[0].items.map((i) => i.href);
  expect(items).toEqual(["/admin", "/admin/work", "/super-admin/reports"]);
});
it("unknown group falls to the end with fallback meta", () => {
  // simulate via the customer surface where "assets" exists but check fallback for a fake id through a module list clone
  const menu = buildMenu("customer", new Set(["customer-dashboard:view", "customer-units:view"]), "PROPERTY_OWNER");
  expect(menu[0].id).toBe("core");
  for (const g of menu) { expect(typeof g.label).toBe("string"); expect(typeof g.defaultOpen).toBe("boolean"); }
});
```
And in `lib/rbac/registry.test.ts`:
```ts
it("every module with a menu references a declared MENU_GROUPS id", () => {
  const ids = new Set(MENU_GROUPS.map((g) => g.id));
  for (const m of RBAC_MODULES) if (m.menu) expect(ids.has(m.menu.group ?? "core"), `${m.key} → ${m.menu.group}`).toBe(true);
});
it("work:view and dashboard:view are default for all four company roles", () => {
  for (const r of ["ADMIN", "MANAGER", "EMPLOYEE"] as const) {
    expect(DEFAULT_PERMISSIONS[r]).toContain("work:view");
    expect(DEFAULT_PERMISSIONS[r]).toContain("dashboard:view");
  }
});
```
Fix the existing test `includes only company modules…` so it expects `"/super-admin"` only when no role is passed (keep as is — `buildMenu("company", perms)` without role still returns the registry href).

- [ ] **Step 2: Run tests, expect failures** — `npx vitest run lib/rbac` → FAIL (`MENU_GROUPS` undefined / wrong order).

- [ ] **Step 3: Implement**
  - `types.ts`: add `MenuGroupDef`.
  - `registry.ts`: add `MENU_GROUPS` with the 10 company rows from the spec table (§2.1) **plus** existing customer/marketplace ids `core`, `properties`, `assets`, `services`, `operations` (already shared label «Εργασίες»… keep: customer-surface `operations` modules keep group id `operations`; the single definition's label «Εργασίες» serves both), `business`, `tasks`, `help`, with labels/colors/icons copied from today's `GROUP_META` in `sidebar-nav.tsx`. Set `defaultOpen:false` only for `settings`, `softone`, `cms`.
  - Re-group company modules: `dashboard`→`overview` (label «Αρχική»), `reports`→`overview`, add `work`; `customers`, `properties`, `units`, `residents` («Ένοικοι & ιδιοκτήτες»), `managed-buildings`, `managed-items`, `onboarding` → `customers`; `maintenance` («Βλάβες & αιτήματα»), `report`, `work-orders`, `maintenance-program` («Ετήσιο πρόγραμμα»), `calendar` → `operations`; `suppliers` → `suppliers`; `announcements` → `communication`; `billing`, `metered-plans`, `customer-wallets`, `company-wallet`, `services`, `api-costs` → `financials`; `settings` («Γενικές ρυθμίσεις»), `settings-company`, `settings-brand`, `settings-payments`, `settings-contracts`, `integrations`, `users`, `roles`, `view-as`, `ai-tools` → `settings`; softone-* unchanged; cms-* unchanged; `help` unchanged. Physically reorder the company entries in that sequence (item order inside a group = registry order). Remove the `preview` group.
  - `DEFAULT_PERMISSIONS`: add `...view("work")` to ADMIN and MANAGER; EMPLOYEE gets `...view("dashboard", "work")`.
  - `permissions-core.ts`: implement `buildMenu` per Interfaces (collect items per group id, then order by `MENU_GROUPS` index, fallback meta for unknown ids).

- [ ] **Step 4: Run tests** — `npx vitest run lib/rbac` → PASS.

- [ ] **Step 5: Commit** — `git add lib/rbac && git commit -m "feat(rbac): menu groups as data, fixed company order, role-aware home, work module"`.

---

### Task 2: Sidebar renders group metadata and default-open state

**Files:**
- Modify: `components/admin/sidebar-nav.tsx` (`ICONS`, `GROUP_META`, `menuToNavGroups`, `openGroups` initial state)

**Interfaces:**
- Consumes `MenuGroup` from Task 1 (`label`, `icon`, `color`, `defaultOpen`).

- [ ] **Step 1: Implement**
  - Delete `GROUP_META`/`FALLBACK_GROUP_META`; `menuToNavGroups` takes `label`, `color` from the group and resolves `icon` via `ICONS[g.icon]?.line ?? RiFileListLine`.
  - Add to `ICONS`: `RiTaskLine: { line: RiTaskLine, fill: RiTaskFill }` (import both).
  - `useState` for `openGroups` initialises from `navGroups.map((g) => [g.id, g.defaultOpen])`; the `localStorage` read stays (stored choice wins).
- [ ] **Step 2: Typecheck** — `npx tsc --noEmit 2>&1 | grep -v "app/api/super-admin/costs" | grep "sidebar-nav\|permissions-core\|registry"` → no lines.
- [ ] **Step 3: Verify in the browser** (needs a logged-in staff session at `http://localhost:3002`): groups appear in the fixed order, Ρυθμίσεις/SoftOne/CMS collapsed on a fresh profile (clear `dg-sidebar-groups` in localStorage via the DevTools console), «Αρχική» opens the role home. Screenshot the sidebar expanded.
- [ ] **Step 4: Commit** — `git commit -am "feat(sidebar): group labels/icons/default-open from the RBAC registry"`.

---

### Task 3: Fix broken home links + quick actions for the work center

**Files:**
- Modify: `components/dashboard/homes/AdminHome.tsx` (`quickLinks`), `ManagerHome.tsx` (card hrefs, links), `StaffHome.tsx` (card hrefs, «Όλες» link)
- Modify: `lib/quick-actions.ts`
- Test: `lib/quick-actions.test.ts`

**Interfaces:**
- Produces quick action `A.work = { key: "work", label: "Κέντρο εργασιών", icon: "RiTaskLine", href: "/admin/work" }`.

- [ ] **Step 1: Write the failing tests** (append to `lib/quick-actions.test.ts`; add `"/admin/work"` to `allowed`):
```ts
it("dashboards and fault pages offer the work center; the work center page offers faults/work orders/programme", () => {
  const dash = resolveQuickActions({ pathname: "/admin", role: "ADMIN", allowed, canExpense: true }).map((a) => a.key);
  expect(dash).toContain("work");
  const work = resolveQuickActions({ pathname: "/admin/work", role: "EMPLOYEE", allowed, canExpense: false }).map((a) => a.key);
  expect(work).not.toContain("work");
  expect(work).toEqual(expect.arrayContaining(["report", "faults"]));
  expect(quickActionsTitle("/admin/work", "ADMIN")).toBe("Κέντρο εργασιών");
});
```
- [ ] **Step 2: Run** — `npx vitest run lib/quick-actions.test.ts` → FAIL.
- [ ] **Step 3: Implement**
  - `lib/quick-actions.ts`: add `A.work`; `quickActionsTitle`: `if (p.startsWith("/admin/work")) return "Κέντρο εργασιών";` before the maintenance branch; staff picks: `/admin/work` → `[A.report, A.faults, A.workOrders, A.programme, A.calendar]`; dashboards default → `[A.work, A.report, A.expense, A.faults, A.announcement]`; `/admin/maintenance` and `/admin/work-orders` branches get `A.work` appended (slice(0,5) keeps the cap).
  - Homes: AdminHome `quickLinks` → Ένοικοι & ιδιοκτήτες `/admin/residents`, Ανακοινώσεις `/admin/announcements`, Ημερολόγιο `/staff/calendar`, Αναφορές `/super-admin/reports`. ManagerHome: Μονάδες `/super-admin/units`, Ανοιχτά Αιτήματα + Σε Εξέλιξη + «Όλα» + «Νέο Αίτημα» → `/admin/maintenance`, Ανακοινώσεις → `/admin/announcements`. StaffHome: «Οι Εργασίες μου»/«Σε Εξέλιξη»/«Όλες» → `/admin/work?mine=1`, «Ανοιχτά (Εταιρεία)» → `/admin/maintenance`.
- [ ] **Step 4: Run** — `npx vitest run lib/quick-actions.test.ts` → PASS.
- [ ] **Step 5: Commit** — `git commit -am "fix(homes): real routes for dashboard links; quick action for the work center"`.

---

### Task 4: Work item types + pure normalizers

**Files:**
- Create: `lib/work/types.ts`, `lib/work/normalize.ts`
- Test: `lib/work/normalize.test.ts`

**Interfaces (produces):**
```ts
// lib/work/types.ts (client-safe)
export type WorkSource = "fault" | "work-order" | "rfq" | "programme" | "appointment";
export type WorkStage = "new" | "triage" | "scheduled" | "in-progress" | "waiting-customer" | "awaiting-confirmation" | "on-hold" | "overdue-programme";
export type WorkPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";
export type WorkItem = { id: string; source: WorkSource; sourceId: string; title: string; subtitle: string | null; buildingId: string; buildingName: string; customerName: string | null; stage: WorkStage; rawStatus: string; priority: WorkPriority | null; dueAt: string | null; overdue: boolean; assigneeId: string | null; assigneeName: string | null; supplierName: string | null; handledBy: "COMPANY" | "PROPERTY_ADMIN" | null; href: string; updatedAt: string; description: string | null };
export const SOURCE_LABELS: Record<WorkSource, string>  // fault «Βλάβη», work-order «Σύμβαση έργου», rfq «Αίτημα προσφοράς», programme «Πρόγραμμα», appointment «Ραντεβού»
export const STAGE_LABELS: Record<WorkStage, string>    // new «Νέο», triage «Σε αξιολόγηση», scheduled «Προγραμματισμένο», in-progress «Σε εξέλιξη», waiting-customer «Αναμένει πελάτη», awaiting-confirmation «Αναμένει παραλαβή», on-hold «Σε αναμονή», overdue-programme «Εκπρόθεσμη συντήρηση»
export const STAGE_COLORS: Record<WorkStage, string>    // reuse STATUS_COLORS hues: new #b45309, triage #0369a1, scheduled #7c3aed, in-progress #1d4ed8, waiting-customer #0f766e, awaiting-confirmation #a16207, on-hold #6b7280, overdue-programme #9f1239
export const WORK_SOURCES: readonly WorkSource[]; export const WORK_STAGES: readonly WorkStage[];
```
```ts
// lib/work/normalize.ts (pure)
export type FaultRow = { id: string; title: string; description: string; status: string; priority: string; handledBy: string; slaDueAt: Date | null; updatedAt: Date; buildingId: string; building: { name: string; property?: { customer?: { name: string } | null } | null }; categoryRef?: { name: string } | null; assignedTo?: { id: string; name: string | null } | null; supplier?: { name: string } | null };
export type WorkOrderRow = { id: string; number: string; title: string; description: string; status: string; scheduledAt: Date | null; validUntil: Date | null; updatedAt: Date; buildingId: string; building: { name: string }; customer: { name: string }; supplier: { name: string }; maintenanceRequestId: string | null };
export type RfqRow = { id: string; title: string; description: string; status: string; deadlineAt: Date | null; updatedAt: Date; buildingId: string; building: { name: string }; maintenanceRequestId: string | null; _count: { offers: number } };
export type ProgrammeRow = { id: string; title: string; notes: string | null; nextDueDate: Date | null; updatedAt: Date; buildingId: string; building: { name: string }; supplier?: { name: string } | null; vendor: string | null; managedItem?: { itemType: { name: string } } | null };
export type AppointmentRow = { id: string; startAt: Date; endAt: Date; managerPresence: boolean; request: { id: string; title: string; buildingId: string; building: { name: string }; assignedTo?: { id: string; name: string | null } | null } };
export function faultToWorkItem(r: FaultRow, now: Date): WorkItem | null          // null for COMPLETED/CANCELLED
export function workOrderToWorkItem(r: WorkOrderRow, now: Date): WorkItem | null  // null for CONFIRMED/DECLINED/CANCELLED
export function rfqToWorkItem(r: RfqRow, now: Date): WorkItem | null              // null unless OPEN/OFFERED/FORWARDED
export function programmeToWorkItem(r: ProgrammeRow, now: Date): WorkItem | null  // null when nextDueDate null
export function appointmentToWorkItem(r: AppointmentRow, now: Date): WorkItem
```
Hrefs: fault `/admin/maintenance/<id>`; work-order `/admin/work-orders` (list; `maintenanceRequestId` present → `/admin/maintenance/<reqId>`); rfq → `/admin/maintenance/<maintenanceRequestId>` else `/admin/maintenance`; programme `/admin/maintenance-program?building=<buildingId>`; appointment `/admin/maintenance/<request.id>`. Ids: `fault:<id>`, `wo:<id>`, `rfq:<id>`, `programme:<id>`, `appt:<id>`. `overdue = dueAt !== null && dueAt < now`. Programme stage `overdue-programme` when overdue else `scheduled`. Priority: faults only (cast; unknown → `"NORMAL"`); others `null`. Subtitle: fault → category name; WO → `number`; rfq → `${_count.offers} προσφορές`; programme → item type name or vendor; appointment → `HH:MM–HH:MM` (el-GR) + «παρουσία διαχειριστή» when `managerPresence`.

- [ ] **Step 1: Write failing tests** `lib/work/normalize.test.ts` covering: fault OPEN with past `slaDueAt` → `stage "new"`, `overdue true`, `href`, `priority "URGENT"`; fault COMPLETED → `null`; fault with `slaDueAt null` → `dueAt null`, `overdue false`; WO PENDING_CUSTOMER with only `validUntil` → `stage "waiting-customer"`, `dueAt = validUntil`; WO COMPLETED → `awaiting-confirmation`; WO CONFIRMED → `null`; rfq OFFERED with 2 offers → `triage`, subtitle `"2 προσφορές"`; rfq ACCEPTED → `null`; programme past due → `overdue-programme`; programme future → `scheduled`, `dueAt` = nextDueDate ISO; appointment → `scheduled`, `dueAt` = startAt ISO, assignee copied from request.
- [ ] **Step 2: Run** — `npx vitest run lib/work` → FAIL (module missing).
- [ ] **Step 3: Implement** `types.ts` and `normalize.ts` per Interfaces.
- [ ] **Step 4: Run** — `npx vitest run lib/work` → PASS.
- [ ] **Step 5: Commit** — `git add lib/work && git commit -m "feat(work): unified WorkItem view-model + pure normalizers"`.

---

### Task 5: KPIs, filters and URL (de)serialisation

**Files:**
- Create: `lib/work/kpis.ts`
- Test: `lib/work/kpis.test.ts`

**Interfaces (produces):**
```ts
export type WorkKpis = { overdue: number; today: number; week: number; unassigned: number };
export type WorkQuickFilter = "overdue" | "today" | "week" | "unassigned";
export type WorkFilters = { f?: WorkQuickFilter; source?: WorkSource[]; stage?: WorkStage[]; building?: string; assignee?: string | "none"; priority?: WorkPriority[]; mine?: boolean; from?: string; to?: string; q?: string };
export function athensDayKey(d: Date): string            // "YYYY-MM-DD" in Europe/Athens (Intl.DateTimeFormat, en-CA)
export function computeKpis(items: WorkItem[], now: Date): WorkKpis
export function isUnassigned(item: WorkItem): boolean    // source fault, handledBy COMPANY, no assignee, no supplier
export function isMine(item: WorkItem, userId: string): boolean // assigneeId === userId || (fault && handledBy COMPANY && !assigneeId && !supplierName)
export function applyFilters(items: WorkItem[], filters: WorkFilters, ctx: { now: Date; userId: string }): WorkItem[]
export function parseFilters(params: Record<string, string | string[] | undefined> | URLSearchParams): WorkFilters
export function serializeFilters(filters: WorkFilters): string  // query string without "?", stable key order f,source,stage,building,assignee,priority,mine,from,to,q
```
Semantics: `today` = items with `dueAt` on the Athens day of `now` (overdue items of today count once in both overdue and today); `week` = `dueAt` within Monday–Sunday of `now`'s Athens week; `f=overdue` → `overdue`, `f=today`/`week` as above, `f=unassigned` → `isUnassigned`; `from`/`to` are `YYYY-MM-DD` inclusive on `dueAt`'s Athens day; `assignee: "none"` → no assignee; `q` = case-insensitive substring over title/subtitle/buildingName. `parseFilters` accepts comma-separated lists, drops unknown values, `mine` = `"1"|"true"`.

- [ ] **Step 1: Write failing tests** `lib/work/kpis.test.ts` with a fixed `now = new Date("2026-10-20T10:00:00+03:00")` and 6 hand-built items: overdue fault (unassigned, COMPANY), fault due today 18:00 assigned to `u1`, WO due in 3 days, programme overdue, appointment next Monday, fault with `dueAt null`. Assert `computeKpis` → `{ overdue: 2, today: 2, week: 3, unassigned: 1 }` (compute exact numbers from the fixture you write and pin them); `applyFilters({ mine: true }, u1)` returns the assigned fault and the unassigned COMPANY fault; `applyFilters({ source: ["programme"] })` length 1; `applyFilters({ from: "2026-10-21", to: "2026-10-23" })` returns only the WO; `parseFilters(new URLSearchParams("f=xyz&source=fault,nope&priority=LOW,FOO&mine=1"))` → `{ source: ["fault"], priority: ["LOW"], mine: true }`; `serializeFilters(parseFilters(x)) === "source=fault&priority=LOW&mine=1"`.
- [ ] **Step 2: Run** — `npx vitest run lib/work/kpis.test.ts` → FAIL.
- [ ] **Step 3: Implement** `lib/work/kpis.ts`.
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** — `git add lib/work && git commit -m "feat(work): KPIs, filters and URL serialisation (pure)"`.

---

### Task 6: Server loader, scope and viewer

**Files:**
- Create: `lib/work/queries.ts` (server-only), `lib/work/scope.ts` (pure helpers used by queries)
- Test: `lib/work/scope.test.ts`

**Interfaces (produces):**
```ts
// lib/work/scope.ts (pure)
export type WorkScope = { role: string; userId: string; customerIds: string[] | null };
export type WorkViewer = { id: string; role: string; canAssign: boolean; canManage: boolean; defaultMine: boolean };
export function customerIdsForScope(role: string, managedCustomerIds: string[]): string[] | null // MANAGER && length>0 → ids, else null
export function viewerFor(role: string, userId: string): WorkViewer // canAssign = SUPER_ADMIN|ADMIN|MANAGER; canManage = any company role; defaultMine = role === "EMPLOYEE"
// lib/work/queries.ts (server-only)
export async function resolveWorkScope(): Promise<WorkScope>       // getEffectiveSession + db.customer.findMany({ where: { accountManagerId } })
export async function loadWorkItems(scope: WorkScope, now?: Date): Promise<WorkItem[]>  // 5 parallel queries (spec §3.4), normalizers from Task 4, sorted: overdue first, then dueAt asc nulls last, then updatedAt desc
export async function loadWorkSummary(scope: WorkScope): Promise<WorkKpis>
export async function countRecentSupportTickets(days?: number): Promise<number>        // 0 when TICKETING_URL unset
export async function listAssignableEmployees(): Promise<{ id: string; name: string }[]> // role in EMPLOYEE/MANAGER/ADMIN, status ACTIVE, name ?? email
export async function managedCustomerIds(userId: string, role: string): Promise<string[] | null> // customerIdsForScope(role, ids of db.customer where accountManagerId=userId)
```
Query `where` for the customer scope: `building: { customerId: { in: customerIds } }` on faults/WOs/RFQs/tasks (same path `/admin/maintenance` uses); appointments via `request: { building: { customerId: { in } } }`.

- [ ] **Step 1: Write failing tests** `lib/work/scope.test.ts`: `customerIdsForScope("MANAGER", ["c1"])` → `["c1"]`; `("MANAGER", [])` → `null`; `("ADMIN", ["c1"])` → `null`; `viewerFor("EMPLOYEE","u")` → `{ canAssign: false, canManage: true, defaultMine: true }`; `viewerFor("MANAGER","u").canAssign` → `true`.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement** `scope.ts` then `queries.ts`. **Step 4: Run** — `npx vitest run lib/work` → PASS; `npx tsc --noEmit` shows no errors under `lib/work`.
- [ ] **Step 5: Commit** — `git add lib/work && git commit -m "feat(work): server loader with role scope"`.

---

### Task 7: Company-wide realtime channel

**Files:**
- Modify: `lib/realtime/bus.ts`, `app/api/realtime/route.ts`, `components/realtime/AutoRefresh.tsx`, `app/actions/rfq.ts` (`revalidate()` helper)
- Test: `lib/realtime/bus.test.ts`

**Interfaces (produces):**
```ts
export type CompanyEventType = "work";
export function publishCompanyEvent(type: CompanyEventType): void
export function subscribeCompany(listener: (e: { type: CompanyEventType }) => void): () => void
// publishBuildingEvent(buildingId, "maintenance" | "calendar") ALSO calls publishCompanyEvent("work")
// AutoRefresh props: { buildingId?: string; scope?: "company" }  → EventSource `/api/realtime?scope=company` when scope given
```
- [ ] **Step 1: Write failing test** in `lib/realtime/bus.test.ts`: subscribing to company and publishing `publishBuildingEvent("b1", "maintenance")` delivers `{ type: "work" }`; `publishBuildingEvent("b1", "file")` does not; `publishCompanyEvent("work")` delivers.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement** bus; route: when `scope === "company"` require `STAFF.includes(role)` else 403, subscribe to company; `AutoRefresh` builds the URL from `scope ?? buildingId` (require one); `app/actions/rfq.ts` `revalidate()` adds `publishCompanyEvent("work")` unconditionally. **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** — `git commit -am "feat(realtime): company-wide work channel"`.

---

### Task 8: `/admin/work` page + client

**Files:**
- Create: `app/(company)/admin/work/page.tsx`, `app/(company)/admin/work/WorkCenterClient.tsx`, `app/(company)/admin/work/WorkFilterBar.tsx`, `components/work/pills.tsx` (`SourcePill`, `StagePill`, `DuePill` — client-safe)

**Interfaces:**
- Consumes Task 4–7 exports; `DataTable` from `@/components/ui/data-table` (`clientSide`, `toolbar`, `getRowActions`, `batchActions`, `expandedContent`); `KpiCard` from `@/components/dashboard/kit`; `assignRequest(id, assigneeId|null)`, `changeRequestStatus(id, status)` from `@/app/actions/maintenance-requests`; `STATUS_TRANSITIONS`, `STATUS_LABELS` from `@/lib/maintenance-shared`.
- `page.tsx` (`export const metadata = { title: "Κέντρο εργασιών" }`, `export const dynamic = "force-dynamic"`): `await requirePermission("work","view")`; `scope = await resolveWorkScope()`; `viewer = viewerFor(scope.role, scope.userId)`; `Promise.all([loadWorkItems(scope), countRecentSupportTickets(), viewer.canAssign ? listAssignableEmployees() : []])`; `filters = parseFilters(await searchParams)` with `mine` defaulting to `viewer.defaultMine` when the param is absent; render `<WorkCenterClient items={items} filters={filters} viewer={viewer} employees buildings={unique buildings from items} supportCount />` and `<AutoRefresh scope="company" />`.
- `WorkCenterClient` props: `{ items: WorkItem[]; filters: WorkFilters; viewer: WorkViewer; employees: { id: string; name: string }[]; buildings: { id: string; name: string }[]; supportCount: number }`. Derives `kpis = computeKpis(items, now)` and `visible = applyFilters(items, filters, { now, userId: viewer.id })` on the client (same pure functions). Filter changes → `router.replace("/admin/work?" + serializeFilters(next))`. Mutations: `await assignRequest(...)`/`changeRequestStatus(...)`, show `result.error` via `alert`-free inline toast (reuse the pattern in `MaintenanceListClient` if one exists, else a small status line), then `router.refresh()`.
- Columns (ids): `source`, `title`, `building`, `stage`, `priority`, `due`, `assignee`, `supplier`, `updated` (defaultVisible false). Row actions: «Προβολή» always; for `source==="fault"` and `viewer.canManage`: one «→ <STATUS_LABELS[t]>» per `STATUS_TRANSITIONS[rawStatus]`; for `viewer.canAssign`: «Ανάθεση σε…» (opens the same select inline in the expanded row). Batch (`viewer.canAssign`): «Ανάθεση επιλεγμένων» (select employee → loop `assignRequest` over selected fault ids), «→ Σε αξιολόγηση» (OPEN faults only).
- Root: `<div className="dash-page" style={{ display:"flex", flexDirection:"column", gap:18 }}>`; KPI grid `repeat(auto-fit, minmax(180px,1fr))`; active KPI gets `outline: 2px solid var(--color-primary)`.

- [ ] **Step 1: Implement** the four files per Interfaces (read `node_modules/next/dist/docs/` for `searchParams` as a Promise in Next 16 page props).
- [ ] **Step 2: Typecheck + lint** — `npx tsc --noEmit` (no errors in the new files); `npx eslint "app/(company)/admin/work" components/work` → clean.
- [ ] **Step 3: Browser verification** on `http://localhost:3002/admin/work` as the logged-in super admin, then via View-as for `admin@orithon.gr` (ADMIN) and `astamos@i4ria.com` (MANAGER): page renders, KPI click sets `?f=`, chips/selects update the URL and the rows, «Οι εργασίες μου» toggle, expand row, phone width (375) shows cards. **Do not** trigger assignment or status change. Screenshot desktop + phone.
- [ ] **Step 4: Commit** — `git add "app/(company)/admin/work" components/work && git commit -m "feat(work): /admin/work work center page"`.

---

### Task 9: «Εκκρεμότητες» strip on the three homes

**Files:**
- Create: `components/dashboard/WorkSummaryStrip.tsx` (server)
- Modify: `components/dashboard/homes/AdminHome.tsx`, `ManagerHome.tsx`, `StaffHome.tsx`

**Interfaces:**
- `export async function WorkSummaryStrip({ role, userId }: { role: string; userId: string })` → builds scope via `resolveWorkScope()` when `userId` matches the effective session (the preview page passes other ids: then use `{ role, userId, customerIds: null }`), `loadWorkSummary`, renders 4 `KpiCard`s: Εκπρόθεσμα → `/admin/work?f=overdue`, Σήμερα → `?f=today`, Αυτή την εβδομάδα → `?f=week`, Χωρίς ανάθεση → `?f=unassigned`; EMPLOYEE links append `&mine=1`. Title row «Κέντρο εργασιών» with link «Άνοιγμα →».
- [ ] **Step 1: Implement** and mount as the first block after each home's `<h1>` (Manager/Staff homes receive `companyId`; pass `role` as a literal `"MANAGER"` / `"EMPLOYEE"` and `userId` where available — `AdminHome` gets a new optional `userId` prop from `app/(company)/admin/page.tsx`).
- [ ] **Step 2: Verify** `/admin`, `/manager`, `/staff` (View-as) and `/super-admin/preview` still render (preview passes sample ids — strip must not throw when the session user differs).
- [ ] **Step 3: Commit** — `git commit -am "feat(homes): pending-work KPI strip linking to the work center"`.

---

### Task 10: AI read tool `listPendingWork`

**Files:**
- Create: `lib/ai/tools/read/pending-work.ts`
- Modify: `lib/ai/tools/registry.ts` (`TOOLS` after `listCalendarTasks`), `lib/ai/tools/labels.ts` (`listPendingWork: "Εκκρεμείς εργασίες"`)
- Test: `lib/ai/tools/registry.test.ts` (add `vi.mock("@/lib/work/queries", …)`)

**Interfaces:**
```ts
const schema = z.object({ source: z.enum(WORK_SOURCES).optional(), onlyMine: z.boolean().optional(), overdueOnly: z.boolean().optional(), limit: z.number().int().min(1).max(20).optional() });
export const listPendingWork: ReadTool<z.infer<typeof schema>> = { name: "listPendingWork", kind: "read", roles: ["SUPER_ADMIN","ADMIN","MANAGER","EMPLOYEE"], requiredPerm: "work:view", label: "Εκκρεμείς εργασίες", description: "Εκκρεμείς εργασίες της εταιρείας (βλάβες, συμβάσεις έργου, αιτήματα προσφοράς, πρόγραμμα συντηρήσεων, ραντεβού). Φίλτρα: source, onlyMine, overdueOnly.", schema, run }
```
`run`: scope `{ role: ctx.user.role, userId: ctx.user.id, customerIds: await managedCustomerIds(ctx.user.id, ctx.user.role) }` (export a small `managedCustomerIds` from `lib/work/queries.ts` used by `resolveWorkScope` too), `loadWorkItems` → `applyFilters` → map to `{ id, source: SOURCE_LABELS[source], title, building, stage: STAGE_LABELS[stage], dueAt: slice(0,10) | null, overdue, assignee, href }`, `take limit ?? 20`.
- [ ] **Step 1: Extend the registry test** — mock `@/lib/work/queries` (`loadWorkItems: vi.fn()`, `managedCustomerIds: vi.fn()`); add `expect(toolsForRole("ADMIN", new Set(["work:view"])).map((t) => t.name)).toContain("listPendingWork")` and `expect(toolsForRole("PROPERTY_ADMIN", new Set(["work:view"])).map((t)=>t.name)).not.toContain("listPendingWork")`. Run → FAIL.
- [ ] **Step 2: Implement** tool + registry + labels. **Step 3: Run** — `npx vitest run lib/ai/tools` → PASS (label-sync test included).
- [ ] **Step 4: Commit** — `git add lib/ai/tools && git commit -m "feat(ai): listPendingWork read tool over the work center loader"`.

---

### Task 11: Wiki article + menu wording updates

**Files:**
- Create: `docs/wiki/pages/admin-work.md`
- Modify: `docs/wiki/basics.md:24`, `docs/wiki/roles/staff.md` (lines 20, 45, 88, 137, 181 + new §1 first bullet), `docs/wiki/pages/admin-home.md`, `manager-home.md`, `staff-home.md` (add the «Εκκρεμότητες» strip sentence + `admin-work` in `related`), `docs/wiki/pages/admin-maintenance.md` (title stays; mention the menu name «Βλάβες & αιτήματα»), `lib/help/types.ts` (`AREA_LABELS.core = "Επισκόπηση & κέντρο εργασιών"`, `management = "Πελάτες & ακίνητα"`)
- Test: `lib/help/coverage.test.ts` (existing), `lib/help/hub.test.ts` (if it asserts the old label, update)

Frontmatter for `admin-work.md`:
```
title: Κέντρο εργασιών
route: /admin/work
roles: [SUPER_ADMIN, ADMIN, MANAGER, EMPLOYEE]
area: core
summary: Όλες οι εκκρεμείς εργασίες της εταιρείας σε μία λίστα: βλάβες με SLA, συμβάσεις έργου, αιτήματα προσφοράς, πρόγραμμα συντηρήσεων, ραντεβού· φίλτρα, ανάθεση, «Οι εργασίες μου».
prompts: ["Ποιες εργασίες είναι εκπρόθεσμες;", "Τι έχω να κάνω σήμερα;", "Ποιες βλάβες δεν έχουν ανάθεση;"]
related: [admin-maintenance, admin-work-orders, admin-maintenance-program, staff-calendar]
```
Body sections: «Τι βλέπετε εδώ» (4 κάρτες, chips πηγής/σταδίου, φίλτρα, στήλες), «Βήμα-βήμα» (κλικ κάρτα → φίλτρο· «Οι εργασίες μου»· ανάθεση από τη στήλη «Ανάθεση» (ADMIN/MANAGER)· «→ κατάσταση» από το μενού γραμμής· «Προβολή» για WO/RFQ/πρόγραμμα), «Συχνές ερωτήσεις» (γιατί δεν βλέπω όλα τα κτήρια — MANAGER με πελάτες· ο υπάλληλος βλέπει μόνο τα δικά του by default).
- [ ] **Step 1: Write/modify** the files. Wording: «Συντηρήσεις» (menu) → «Βλάβες & αιτήματα»; «Ενοικιαστές» → «Ένοικοι & ιδιοκτήτες»; «Ετήσιο πρόγραμμα συντηρήσεων» (menu) → «Ετήσιο πρόγραμμα»; basics groups → «Επισκόπηση», «Εργασίες», «Βοήθεια» + sentence that Ρυθμίσεις/SoftOne/Ιστότοπος start collapsed.
- [ ] **Step 2: Run** — `npx vitest run lib/help` → PASS (coverage includes `/admin/work`).
- [ ] **Step 3: Commit** — `git add docs/wiki lib/help && git commit -m "docs(wiki): work center article; menu names updated"`.

---

### Task 12: RBAC backfill, full checks, screenshots, memory

**Files:**
- Modify: `/Users/kozyris/.claude/projects/-Volumes-EXTERNALSSD-propertymanagement/memory/project_admin_dashboards.md`, `MEMORY.md` index line
- Shared notes: `/Users/kozyris/Library/Application Support/Claude/side-session-notes/local_c04ae2ec-6468-44b9-b796-ab8d1af18e64/company-menu-work-center-handover.md`

- [ ] **Step 1: Backfill permissions** — `npx tsx --env-file=.env prisma/seed-rbac.ts` → output lists `backfilled ADMIN: [work]`, `MANAGER: [work]`, `EMPLOYEE: [dashboard, work]`, `SUPER_ADMIN: [work]`. Re-run the read-only menu dump (scratchpad `menus.ts` from exploration) and save as `after-menu.md`.
- [ ] **Step 2: Full checks** — `npx tsc --noEmit` (only the known pre-existing errors), `npm run lint` (no new errors in touched files; record the repo-wide count before/after), `npm run test` (all green except the pre-existing `lib/building-caps.test.ts`).
- [ ] **Step 3: Screenshots after** — sidebar for SUPER_ADMIN, ADMIN, MANAGER (View-as) + `/admin/work` desktop/phone; store under the scratchpad and reference paths in the hand-over note.
- [ ] **Step 4: Memory** — update `project_admin_dashboards.md` (menu groups as data, `/admin/work`, `lib/work/*`, company SSE channel, EMPLOYEE now has Αρχική) and write the hand-over note (what shipped, commits, backfill done, what was not browser-verified: EMPLOYEE).
- [ ] **Step 5: Commit** — `git add -A docs lib app components prisma && git commit -m "chore: work center follow-ups (notes)"` (memory files live outside the repo; only commit repo files).
