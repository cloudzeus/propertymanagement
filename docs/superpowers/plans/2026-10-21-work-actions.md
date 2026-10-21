# Work actions (ενέργειες εργασιών) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every next step of a fault, RFQ or work order is one click away from any list row (⋯ menu), from an «Ενέργειες» button on the detail pages, or from batch actions — driven by one shared action model, one set of dialogs, and the existing server actions.

**Architecture:** A pure resolver (`lib/work/actions.ts`: subject × viewer → grouped actions) decides what is offered; a client hook + dialog host (`components/work/useWorkActions.tsx`, `WorkActionHost.tsx`, `dialogs/*`) renders the same dialogs everywhere and calls the existing server actions (`maintenance-requests.ts`, `rfq.ts`, `suppliers.ts`). Lists get light `flags` through the existing queries; dialogs load heavy data on open through one read action (`loadWorkActionContext`). Three server-side additions only: `scheduleRequest`, on-behalf notes on `respondWorkOrder`/`confirmWorkOrder`, and `loadWorkActionContext`. A new `/admin/work-orders/[id]` page.

**Tech Stack:** Next.js 16.2 App Router (server components for data, `"use server"` actions), Prisma 7/PostgreSQL (no schema change), Auth.js v5 effective session, dynamic RBAC (`@/lib/rbac/permissions`), `components/ui/modal.tsx` + `data-table.tsx`, react-icons/ri `*Line`, fluid type `var(--fs-*)`, Vitest.

**Spec:** [docs/superpowers/specs/2026-10-21-work-actions-design.md](../specs/2026-10-21-work-actions-design.md)

## Global Constraints

- No URL or RBAC module key changes; no new permission; no Prisma migration. The new page `/admin/work-orders/[id]` is guarded by `requirePermission("work-orders", "view")`.
- Greek UI copy; font sizes only via `var(--fs-*)`; icons only `react-icons/ri` `*Line` (as icon-name strings in the pure resolver, resolved to components in one map on the client, like `lib/quick-actions.ts` / `QuickActions.tsx`).
- No `alert()` / `confirm()` / `prompt()`; confirmations are dialogs.
- Pure modules (`lib/work/actions.ts`, `subjects.ts`, `normalize.ts`, `scope.ts`, `components/ui/action-menu.tsx` helpers) must not import `server-only`, `next/*` or `@/lib/db`.
- Every client → server call goes through `callAction` from `@/lib/work/client-actions.ts`.
- Server actions keep their existing role/permission guards; this plan only ADDS guards (on-behalf note), never relaxes one.
- The local `DATABASE_URL` is production: no test rows, no submitting any dialog during browser verification. Writes are verified with Vitest + mocked `@/lib/db` (pattern: `app/actions/rfq.test.ts`).
- Known pre-existing failures to ignore: 9 `tsc` errors (auth.ts, costs/*, ForgotPasswordForm, otp.ts, prisma.config.ts, seed.ts), ~339 eslint errors repo-wide, 2 failing tests (`lib/building-caps.test.ts`, date-sensitive `lib/ai/assistant/actions.test.ts`). Touched files must add zero new errors.
- Wiki: `lib/help/coverage.test.ts` must pass (every `page.tsx` has an article with the same route).
- Shared checkout on `main`: commit only your own files after every task with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`; never stash/reset/branch-switch/push.
- Read `node_modules/next/dist/docs/` before using an App Router API you are unsure of.

## Review Focus

1. A fault whose `liveWo` is CONFIRMED must still allow «Αίτημα προσφοράς…» (a new job after a finished one) while a PENDING_CUSTOMER / ACCEPTED / COMPLETED one must block it. → Task 1 test "create-rfq after a confirmed work order".
2. Staff who IS also a decider cannot happen (deciders are PROPERTY_ADMIN), but a SUPER_ADMIN impersonating via View-as calls `respondWorkOrder` with the impersonated role — the on-behalf rule must key off the effective role, not the impersonator. → Task 4 test "note required for MANAGER, not for decider" (uses the effective session mock as production does).
3. `scheduleRequest` with a start exactly on a 30-minute boundary in the past, a start in the future with a non-30′ minute, and a duration of 0/negative/NaN must each be rejected or normalised, never create a half-open appointment. → Task 4 tests.
4. A phone-width table row with 12 actions must never render 12 pills; a list without `primary` flags and ≤ 3 actions must look exactly as before (regression for the other 15 lists). → Task 3 `pickPrimary` tests.
5. On the fault detail page the host dialog opens with stale `flags` after a mutation until `router.refresh()` lands; a second click must not reopen a dialog for an action that no longer applies (e.g. forward after a WO exists). → Task 5: the host re-validates `resolveWorkActions` against the freshly loaded context before rendering the dialog and shows «Η ενέργεια δεν είναι πλέον διαθέσιμη» otherwise (test in Task 5 `dialogAvailable`).

---

### Task 1: Action model — `resolveWorkActions`, `workActionViewer`

**Files:**
- Create: `lib/work/actions.ts`
- Modify: `lib/work/scope.ts` (add `WorkActionViewer`, `workActionViewer`)
- Test: `lib/work/actions.test.ts`, `lib/work/scope.test.ts`

**Interfaces:**
- Consumes: `STATUS_TRANSITIONS`, `STATUS_LABELS`, `FaultStatus` from `@/lib/maintenance-shared`; `COMPANY_ROLES` from `@/lib/roles-constants`.
- Produces (exact):

```ts
// lib/work/scope.ts
export type WorkActionViewer = WorkViewer & { canRfqCreate: boolean; canRfqEdit: boolean; canForward: boolean; canOnBehalf: boolean; canViewFault: boolean };
export function workActionViewer(role: string, userId: string, perms: Set<string>): WorkActionViewer;
// perms are "module:action" strings (same shape as getEffectivePermissions().perms):
// canRfqCreate = company && perms.has("rfq:create"); canRfqEdit = company && perms.has("rfq:edit");
// canForward = canAssign && perms.has("suppliers:edit"); canOnBehalf = canAssign; canViewFault = perms.has("maintenance:view").

// lib/work/actions.ts
export type FaultFlags = { openRfqId: string | null; offersToForward: number; liveWo: { id: string; status: string } | null; hasAppointment: boolean };
export type WorkSubject =
  | { kind: "fault"; id: string; status: string; handledBy: "COMPANY" | "PROPERTY_ADMIN"; assigneeId: string | null; supplierId: string | null; flags: FaultFlags }
  | { kind: "work-order"; id: string; status: string; faultId: string | null }
  | { kind: "rfq"; id: string; status: string; faultId: string | null; offersToForward: number; hasLiveWorkOrder: boolean };
export type WorkActionSection = "status" | "assign" | "schedule" | "offers" | "communicate" | "navigate";
export const SECTION_ORDER: readonly WorkActionSection[];
export type WorkDialog = "assign-employee" | "assign-supplier" | "appointment" | "status-note" | "create-rfq" | "add-rfq-suppliers" | "forward-offer" | "cancel-rfq" | "wo-respond" | "wo-schedule" | "wo-confirm" | "comment" | "rate-supplier";
type Base = { key: string; label: string; icon: string; section: WorkActionSection; primary?: boolean; danger?: boolean };
export type WorkAction =
  | (Base & { kind: "status"; status: FaultStatus })
  | (Base & { kind: "dialog"; dialog: WorkDialog; status?: FaultStatus })   // status-note carries the target status
  | (Base & { kind: "link"; href: string });
export function resolveWorkActions(subject: WorkSubject, viewer: WorkActionViewer, ctx: { where: "list" | "detail" }): WorkAction[];
export const NOTE_STATUSES: readonly FaultStatus[] = ["COMPLETED", "ON_HOLD", "CANCELLED"];
```

Rules are the spec §4.4–4.6 tables verbatim (keys, labels, sections, conditions, primary/danger). Output is ordered by `SECTION_ORDER`, then by table order within a section. Labels switch on state: «Ανάθεση σε υπάλληλο…» ↔ «Αλλαγή υπαλλήλου…» (assigneeId), «Ανάθεση σε συνεργάτη…» ↔ «Αλλαγή συνεργάτη…» (supplierId), «Προγραμματισμός…» ↔ «Αλλαγή ραντεβού…» (WO status SCHEDULED). Icons: status `RiArrowRightLine` (CANCELLED `RiCloseCircleLine`), assign-employee `RiUserAddLine`, assign-supplier `RiTeamLine`, appointment `RiCalendarCheckLine`, create-rfq `RiMoneyEuroCircleLine`, add-rfq-suppliers `RiUserAddLine`, forward-offer `RiSendPlaneLine`, cancel-rfq `RiCloseCircleLine`, wo-respond `RiCheckDoubleLine`, wo-schedule `RiCalendarEventLine`, wo-confirm `RiShieldCheckLine`, comment `RiChat3Line`, rate-supplier `RiStarLine`, view/view-fault `RiEyeLine`, view-wo/contract-* `RiFileTextLine`.

- [ ] **Step 1: Write the failing tests** — `lib/work/scope.test.ts` (append) and `lib/work/actions.test.ts`. Helpers: `fault(over)` building a default OPEN COMPANY subject with empty flags; `viewer(role, perms[])` via `workActionViewer`. Assert on `actions.map(a => a.key)`.

```ts
// scope.test.ts
it("workActionViewer derives rfq/forward/on-behalf caps from perms", () => {
  const v = workActionViewer("MANAGER", "u", new Set(["rfq:create", "rfq:edit", "suppliers:edit", "maintenance:view"]));
  expect(v).toMatchObject({ canAssign: true, canRfqCreate: true, canRfqEdit: true, canForward: true, canOnBehalf: true, canViewFault: true });
  const e = workActionViewer("EMPLOYEE", "u", new Set(["rfq:create", "suppliers:view", "maintenance:view"]));
  expect(e).toMatchObject({ canAssign: false, canRfqCreate: true, canRfqEdit: false, canForward: false, canOnBehalf: false });
  expect(workActionViewer("PROPERTY_ADMIN", "u", new Set(["rfq:create"])).canRfqCreate).toBe(false);
});
// actions.test.ts
it("OPEN company fault, manager: full menu in section order", () => {
  const keys = resolveWorkActions(fault(), mgr, { where: "list" }).map((a) => a.key);
  expect(keys).toEqual(["status:ACKNOWLEDGED", "status:SCHEDULED", "status:IN_PROGRESS", "status:CANCELLED", "assign-employee", "assign-supplier", "appointment", "create-rfq", "comment", "view"]);
});
it("marks the first non-cancel transition and unassigned company fault as primary; CANCELLED is danger + note dialog", ...);
it("ON_HOLD / COMPLETED / CANCELLED transitions are status-note dialogs carrying the status", ...);
it("EMPLOYEE gets status, appointment, comment, create-rfq (rfq:create) but no assign/forward/on-behalf", ...);
it("open RFQ → add-rfq-suppliers replaces create-rfq; offersToForward>0 and no liveWo → forward-offer (primary)", ...);
it("liveWo PENDING_CUSTOMER → wo-respond + view-wo, no forward/create; ACCEPTED → wo-schedule; COMPLETED → wo-confirm", ...);
it("create-rfq after a confirmed work order is allowed, after PENDING/ACCEPTED/COMPLETED it is not", ...);
it("closed fault: no status/assign/appointment/create-rfq; COMPLETED with supplier → rate-supplier for canAssign only", ...);
it("where=detail drops the view link", ...);
it("work-order subject: respond/schedule/confirm by status, contracts and fault links", ...);
it("rfq subject: add/forward/cancel by status and perms; view-fault needs canViewFault", ...);
it("viewer without canForward never sees forward-offer even with offers", ...);
```

- [ ] **Step 2: Run** `npx vitest run lib/work/actions.test.ts lib/work/scope.test.ts` → FAIL (module not found / not a function).
- [ ] **Step 3: Implement** `workActionViewer` in `lib/work/scope.ts` and `lib/work/actions.ts` per the Interfaces block and spec tables. One builder per subject kind; a final `sort` by `SECTION_ORDER.indexOf(section)` that is stable.
- [ ] **Step 4: Run** the two test files → PASS. Run `npx vitest run lib/work` → all green.
- [ ] **Step 5: Commit** `feat(work): action model — resolveWorkActions + workActionViewer`.

---

### Task 2: Subjects + flags in lists

**Files:**
- Create: `lib/work/subjects.ts`
- Modify: `lib/work/types.ts` (`WorkItem.flags?: FaultFlags; WorkItem.rfq?: { offersToForward: number; hasLiveWorkOrder: boolean }`), `lib/work/normalize.ts`, `lib/work/queries.ts:36-63`, `components/maintenance/types.ts` (`FaultListItem` += `assigneeId?: string | null; flags?: FaultFlags`), `app/(company)/admin/maintenance/page.tsx`, `lib/rfq.ts:138-161` (`RfqInvitationRowDTO` += `hasLiveWorkOrder: boolean`, `offersToForward: number`), `lib/rfq-shared.ts:162-169`
- Test: `lib/work/normalize.test.ts` (append), `lib/work/subjects.test.ts`

**Interfaces:**
- Consumes: `FaultFlags`, `WorkSubject` (Task 1); `WorkItem`, `FaultListItem`, `WorkOrderDTO`, `RfqInvitationRowDTO`, `FaultDetail`.
- Produces:

```ts
// lib/work/normalize.ts
export type FaultRow = /* existing */ & { supplierId?: string | null; serviceRequests?: { id: string; offers: { id: string }[] }[]; workOrders?: { id: string; status: string }[]; _count?: { appointments: number } };
export type RfqRow = /* existing */ & { offers?: { id: string }[]; workOrders?: { id: string }[] };
export function faultFlags(r: FaultRow): FaultFlags;   // openRfqId = serviceRequests[0]?.id ?? null; offersToForward = Σ offers; liveWo = workOrders[0] ?? null; hasAppointment = _count.appointments > 0
// faultToWorkItem sets item.flags = faultFlags(r); rfqToWorkItem sets item.rfq; workOrderToWorkItem.href = `/admin/work-orders/${r.id}`
// lib/work/subjects.ts
export function subjectFromWorkItem(w: WorkItem): WorkSubject | null;          // programme/appointment → null
export function subjectFromFaultListItem(f: FaultListItem): WorkSubject;        // flags default to empty when absent
export function subjectFromFaultDetail(d: FaultDetail, rfq: { rfqs: RfqDTO[]; workOrders: WorkOrderDTO[] } | null): WorkSubject;
export function subjectFromWorkOrderDTO(w: WorkOrderDTO): WorkSubject;
export function subjectFromRfqInvitationRow(r: RfqInvitationRowDTO): WorkSubject;
export const EMPTY_FLAGS: FaultFlags;
```

Query selects (spec §5.1): faults add `supplierId: true, serviceRequests: { where: { status: { in: ["OPEN", "OFFERED"] } }, select: { id: true, offers: { where: { status: "SUBMITTED" }, select: { id: true } } } }, workOrders: { where: { status: { notIn: ["DECLINED", "CANCELLED"] } }, orderBy: { createdAt: "desc" }, take: 1, select: { id: true, status: true } }, _count: { select: { appointments: true } }`; RFQs add `offers: { where: { status: "SUBMITTED" }, select: { id: true } }, workOrders: { where: { status: { notIn: ["DECLINED", "CANCELLED"] } }, select: { id: true } }`. The maintenance page uses the same fault additions and maps `assigneeId: r.assignedToId` (add `assignedToId` to its include) + `flags: faultFlags(r)`. `listRfqInvitationRows` adds `workOrders: { where: { status: { notIn: [...] } }, select: { id: true } }` to the rfq select; `offersToForward = offers.filter(o => o.status === "SUBMITTED").length`, `hasLiveWorkOrder = workOrders.length > 0`.

- [ ] **Step 1: Tests** — normalize: `faultFlags` with no relations → `EMPTY_FLAGS`; with one OPEN rfq holding 2 SUBMITTED offers and a PENDING_CUSTOMER WO → `{ openRfqId: "r1", offersToForward: 2, liveWo: { id: "w1", status: "PENDING_CUSTOMER" }, hasAppointment: false }`; `workOrderToWorkItem(...).href === "/admin/work-orders/w1"`; `rfqToWorkItem(...).rfq` set. subjects: one test per converter asserting the exact subject object (including `subjectFromWorkItem` returning `null` for programme/appointment, and `subjectFromFaultDetail` deriving flags from the rfq panel data: open RFQ = status OPEN/OFFERED, offersToForward = SUBMITTED offers of open RFQs, liveWo = first WO with status ∉ {DECLINED, CANCELLED}, hasAppointment = `appointments.length > 0`).
- [ ] **Step 2: Run** `npx vitest run lib/work` → FAIL.
- [ ] **Step 3: Implement** types, `faultFlags`, converters, query/page/rfq-list select changes. `lib/work/queries.test.ts` may need its fixture rows extended (optional fields → no change required).
- [ ] **Step 4: Run** `npx vitest run lib/work lib/rfq` and `npx tsc --noEmit` (no new errors) → PASS.
- [ ] **Step 5: Commit** `feat(work): subject converters + fault/RFQ flags in list queries; WO rows link to /admin/work-orders/[id]`.

---

### Task 3: DataTable sections/primary, `ActionMenuList`, `ActionSheet`

**Files:**
- Create: `components/ui/action-menu.tsx`, `components/ui/action-sheet.tsx`
- Modify: `components/ui/data-table.tsx` (`RowAction` type :37-42; phone card actions :464-477; desktop dropdown :780-826)
- Test: `components/ui/action-menu.test.ts`

**Interfaces:**

```ts
// data-table.tsx
export type RowAction<T> = { label: string; icon?: React.ReactNode; onClick: (row: T) => void; danger?: boolean; section?: string; primary?: boolean };
// action-menu.tsx ("use client"; helpers are pure and exported for tests)
export type MenuEntry = { key: string; label: string; icon?: React.ReactNode; danger?: boolean; section?: string; primary?: boolean; onPick: () => void };
export function groupActions(entries: MenuEntry[]): MenuEntry[][];          // groups by section in first-appearance order; undefined section = its own group in place; no empty groups
export function pickPrimary(entries: MenuEntry[], max = 2): { pills: MenuEntry[]; overflow: MenuEntry[] };
//   ≤ 3 entries and none primary → pills = all, overflow = []; otherwise pills = primary (≤ max) or first `max`, overflow = all entries
export function ActionMenuList({ entries, onPicked }: { entries: MenuEntry[]; onPicked?: () => void }): JSX.Element;  // groups separated by 1px var(--border); danger = var(--destructive); items ≥ 36px tall
// action-sheet.tsx
export function ActionSheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode }): JSX.Element | null;
//   portal to document.body, fixed bottom, max-height 80vh, scroll, backdrop click + Esc close, padding-bottom env(safe-area-inset-bottom)
```

DataTable: desktop dropdown renders `<ActionMenuList entries={toEntries(rowActions, row)} onPicked={() => setMenuOpen(false)} />`; phone card renders `pickPrimary(...)`: pills for `pills`, plus a «Ενέργειες (N)» pill opening `<ActionSheet title={firstCellText}>` with the full list when `overflow.length > 0`.

- [ ] **Step 1: Tests** for `groupActions` (order preserved, mixed sectioned/unsectioned, no empty groups) and `pickPrimary` (3 unflagged → all pills no overflow; 5 unflagged → first 2 + overflow 5; 12 with 3 primary → first 2 primary + overflow 12; 1 primary among 4 → 1 pill + overflow).
- [ ] **Step 2: Run** `npx vitest run components/ui/action-menu.test.ts` → FAIL.
- [ ] **Step 3: Implement** the two components and wire DataTable (keep all existing styles; the desktop menu container stays as is, only its children change).
- [ ] **Step 4: Run** tests → PASS; `npx tsc --noEmit`; open `http://localhost:3002/admin/work` in the browser pane (preview `dev-3002`) and confirm the ⋯ menu still opens (unchanged behaviour).
- [ ] **Step 5: Commit** `feat(ui): grouped row-action menu, primary pills + action sheet on phones`.

---

### Task 4: Server actions — `scheduleRequest`, on-behalf notes, `loadWorkActionContext`

**Files:**
- Modify: `app/actions/maintenance-requests.ts` (after `bookSlot`, :416), `app/actions/rfq.ts` (`respondWorkOrder` :274, `confirmWorkOrder` :431)
- Create: `app/actions/work-actions.ts`
- Test: `app/actions/maintenance-requests.test.ts` (new, mock pattern of `rfq.test.ts`), `app/actions/rfq.test.ts` (append)

**Interfaces:**

```ts
// maintenance-requests.ts
export async function scheduleRequest(id: string, isoStart: string, durationMinutes?: number | null): Promise<{ ok: true } | { error: string }>;
//  requireUser → load req { title, status, buildingId, handledBy, reportedById, supplierId, estimatedMinutes, managerPresence, building.propertyId }
//  guards (in order, messages exact): !req → "Δεν βρέθηκε"; !canManageRequest → "Δεν επιτρέπεται"; closed → "Η βλάβη έχει κλείσει";
//  invalid/past start → "Η ημερομηνία πρέπει να είναι στο μέλλον"; minutes % 30 || seconds → "Η ώρα πρέπει να είναι σε όρια 30 λεπτών";
//  duration = durationMinutes finite > 0 ? round to 30 (min 30) : req.estimatedMinutes ?? 60.
//  $transaction: maintenanceAppointment.create { requestId, startAt, endAt, managerPresence: req.managerPresence, bookedById: user.id },
//  maintenanceRequest.update { scheduledDate: startAt, estimatedMinutes: duration, ...(STATUS_TRANSITIONS[status].includes("SCHEDULED") ? { status: "SCHEDULED", statusEvents: { create: { fromStatus, toStatus: "SCHEDULED", byUserId, note: `Ραντεβού ${when}` } } } : { statusEvents: { create: { fromStatus: status, toStatus: status, byUserId, note: `Ραντεβού ${when}` } } }) }
//  notifyStakeholders type MAINTENANCE_APPOINTMENT, title `Ραντεβού για τη βλάβη «${title}»`, body `Ορίστηκε ραντεβού: ${when} (διάρκεια ~${duration}')`, excludeUserId; revalidateAll.
// rfq.ts
export type OnBehalf = { onBehalfNote?: string | null };
export async function respondWorkOrder(woId: string, accept: boolean, reason?: string | null, opts?: OnBehalf);
export async function confirmWorkOrder(woId: string, confirm: boolean, note?: string | null, opts?: OnBehalf);
//  after the existing status check: const decider = await isDecider(a, wo.buildingId); if (!decider && !isStaff(a)) → existing error;
//  if (!decider) { const n = clean(opts?.onBehalfNote); if (!n || n.length < 5) return { error: "Γράψτε πώς συμφώνησε ο πελάτης (τουλάχιστον 5 χαρακτήρες)" }; onBehalf = n; }
//  on success and onBehalf && wo.maintenanceRequestId: maintenanceStatusEvent.create { requestId, toStatus: accept ? "ACCEPTED_ON_BEHALF" : "DECLINED_ON_BEHALF" | confirm ? "CONFIRMED_ON_BEHALF" : "DISPUTED_ON_BEHALF", byUserId: a.id, note: `Εκ μέρους πελάτη: ${onBehalf}` } and maintenanceComment.create { requestId, authorId: a.id, internal: true, body: `${label} εκ μέρους πελάτη (${wo.number}): ${onBehalf}` }
//  where label ∈ {"Αποδοχή προσφοράς", "Απόρριψη προσφοράς", "Επιβεβαίωση παραλαβής", "Αμφισβήτηση παραλαβής"}.
// work-actions.ts ("use server")
export type WorkActionContext = {
  fault: { id: string; title: string; status: string; handledBy: string; assigneeId: string | null; supplierId: string | null; buildingId: string; categoryId: string | null; categoryName: string | null; restrictedAccess: boolean; estimatedMinutes: number | null; managerPresence: boolean; slots: FaultDetail["slots"]; appointments: FaultDetail["appointments"] } | null;
  employees: { id: string; name: string }[]; suppliers: { id: string; name: string }[]; preferredSupplierId: string | null;
  picker: RfqPickerData; rfqs: RfqDTO[]; workOrders: WorkOrderDTO[]; defaults: { markupPct: number; warrantyMonths: number };
};
export async function loadWorkActionContext(subject: { kind: "fault" | "work-order" | "rfq"; id: string }): Promise<WorkActionContext | { error: string }>;
//  resolve faultId: fault → id; work-order → workOrder.maintenanceRequestId; rfq → serviceRequest.maintenanceRequestId.
//  guards: company role else { error: "Δεν επιτρέπεται" }; requirePermission-equivalent via can(perms, "maintenance"|"work-orders"|"rfq", "view") by kind;
//  MANAGER scope: building.customerId ∈ managedCustomerIds (from lib/work/queries) else { error: "Εκτός εμβέλειας" }.
//  data: loadFaultDetail (subset), listAssignableEmployees (canAssign), listRfqCandidates + describeRank + buildingPreferredSupplier (canAssign, copied from maintenance/[id]/page.tsx:34-45), loadRfqPanel (rfq:view) else { rfqs: [], workOrders: [WO of subject], defaults }.
```

- [ ] **Step 1: Tests**
  - `maintenance-requests.test.ts`: mock `@/lib/db` (`maintenanceRequest.findUnique/update`, `maintenanceAppointment.create`, `$transaction` running the callback with the same mock), `@/lib/auth-effective` (role MANAGER), `@/lib/maintenance-requests` (`notifyStakeholders: vi.fn`), `next/cache`, `@/lib/realtime/bus`, `@/lib/building-access`. Cases: past start → error; non-30′ → error; closed → error; OPEN + 90 min → status SCHEDULED, event note starts with "Ραντεβού", appointment endAt = start + 90′, `estimatedMinutes: 90`; IN_PROGRESS → appointment created, status unchanged, event from=to=IN_PROGRESS; no duration + estimatedMinutes 60 → 60; duration 0/NaN → falls back to estimate; notify called with `excludeUserId`.
  - `rfq.test.ts`: add `m.wo` PENDING_CUSTOMER cases: MANAGER without note → `{ error: "Γράψτε πώς συμφώνησε ο πελάτης (τουλάχιστον 5 χαρακτήρες)" }` and no update; MANAGER with note → ok, `maintenanceStatusEvent.create` called with note containing the text and `maintenanceComment.create` with `internal: true`; decider (PROPERTY_ADMIN in `buildingDeciderIds`) without note → ok as before; same three for `confirmWorkOrder` on a COMPLETED WO (dispute without `note` still errors "Γράψτε τι δεν έγινε σωστά").
- [ ] **Step 2: Run** `npx vitest run app/actions` → FAIL on the new cases.
- [ ] **Step 3: Implement** the three changes exactly as in Interfaces. Add `maintenanceComment.create` to the rfq test db mock.
- [ ] **Step 4: Run** `npx vitest run app/actions` → PASS; `npx tsc --noEmit` no new errors.
- [ ] **Step 5: Commit** `feat(actions): scheduleRequest, on-behalf notes for respond/confirm work order, loadWorkActionContext`.

---

### Task 5: `useWorkActions` hook, `WorkActionHost`, `ActionsButton`, simple dialogs

**Files:**
- Create: `components/work/useWorkActions.tsx`, `components/work/WorkActionHost.tsx`, `components/work/ActionsButton.tsx`, `components/work/ActionToast.tsx`, `components/work/icons.ts`, `components/work/dialogs/AssignEmployeeDialog.tsx`, `AssignSupplierDialog.tsx`, `StatusNoteDialog.tsx`, `CommentDialog.tsx`, `RateSupplierDialog.tsx`, `CancelRfqDialog.tsx`, `components/work/dialogs/shared.tsx` (DialogFrame = `Modal` + busy/error state + footer buttons)
- Create: `lib/work/dialog-guard.ts`
- Test: `lib/work/dialog-guard.test.ts`

**Interfaces:**

```ts
// lib/work/dialog-guard.ts (pure)
export function dialogAvailable(dialog: WorkDialog, subject: WorkSubject, viewer: WorkActionViewer): boolean;  // true iff resolveWorkActions(subject, viewer, {where:"detail"}) contains a dialog action with this dialog
export function subjectFromContext(subject: WorkSubject, ctx: WorkActionContext): WorkSubject;             // fault kind: rebuild flags from ctx.rfqs/workOrders/appointments (same derivation as subjectFromFaultDetail); other kinds: refresh status from ctx.workOrders / ctx.rfqs
// components/work/useWorkActions.tsx ("use client")
export type WorkActionsApi = {
  rowActions: <T>(subject: WorkSubject | null, fallback?: RowAction<T>[]) => RowAction<T>[];   // null subject → fallback ?? []
  batchActions: <T>(subjectsOf: (rows: T[]) => WorkSubject[]) => BatchAction<T>[];            // §4.7; only fault subjects
  open: (dialog: WorkDialog, subject: WorkSubject, status?: FaultStatus) => void;
  runStatus: (subject: WorkSubject, status: FaultStatus) => Promise<void>;                      // changeRequestStatus via callAction + toast + refresh
  Host: () => JSX.Element;                                                                        // render once per page
};
export function useWorkActions(opts: { viewer: WorkActionViewer; where: "list" | "detail" }): WorkActionsApi;
// components/work/ActionsButton.tsx
export function ActionsButton({ subject, viewer, api, label = "Ενέργειες" }: { subject: WorkSubject; viewer: WorkActionViewer; api: WorkActionsApi; label?: string }): JSX.Element;  // desktop: dropdown (ActionMenuList, portal, closes on Esc/outside); phone (useMediaQuery max-width 640px): ActionSheet
// components/work/icons.ts
export const WORK_ICONS: Record<string, React.ElementType>;   // every icon name used by lib/work/actions.ts
// dialogs: each `export function XDialog({ ctx, subject, onDone, onClose }: DialogProps)`; DialogProps = { ctx: WorkActionContext; subject: WorkSubject; status?: FaultStatus; onDone: (message: string) => void; onClose: () => void }
```

Host state machine: `idle → loading(dialog, subject) → ready(ctx) | error`. On `open`: `callAction(() => loadWorkActionContext(subject))`; on ready, compute `fresh = subjectFromContext(subject, ctx)`; if `!dialogAvailable(dialog, fresh, viewer)` show the frame with «Η ενέργεια δεν είναι πλέον διαθέσιμη — η εγγραφή άλλαξε.» and a close button. Dialog `onDone(msg)` → close, `ActionToast` message (same look as the work-center `message` strip: ok green / error red, auto-hide 5s), `router.refresh()` in `startTransition`. `rowActions` maps `WorkAction` → `RowAction`: status → `onClick: () => api.runStatus(...)` (NOTE_STATUSES open `status-note`), dialog → `api.open`, link → `router.push(href)`; `section` and `primary` copied; icon via `WORK_ICONS`.

Dialog copy (exact):
- AssignEmployee: title «Ανάθεση σε υπάλληλο», select placeholder «— Χωρίς ανάθεση —», buttons «Ανάθεση» / «Αφαίρεση ανάθεσης» (when current assignee and selection empty). Calls `assignRequest`.
- AssignSupplier: title «Ανάθεση σε συνεργάτη», coverage badge text from `request-detail.tsx:184-188`, select hint «Ταξινόμηση: προτιμώμενος · ίδιος με προηγούμενη · ειδικότητα · αξιολόγηση · απόσταση · 24/7», checkbox «Ορισμός ως προτιμώμενου συνεργάτη για αυτό το κτήριο», buttons «Ανάθεση» / «Αφαίρεση». Calls `assignRequestSupplier` then `setPreferredSupplier` when ticked.
- StatusNote: title `→ ${STATUS_LABELS[status]}`, textarea «Σημείωση» (required for CANCELLED: «Γράψτε τον λόγο ακύρωσης»), button «Αλλαγή κατάστασης». Calls `changeRequestStatus`.
- Comment: title «Μήνυμα / σημείωση», textarea placeholder «Γράψτε μήνυμα…», checkbox «Εσωτερικό σχόλιο (δεν το βλέπει ο ένοικος)», button «Αποστολή». Calls `addRequestComment`.
- RateSupplier: title `Αξιολόγηση συνεργάτη · ${supplierName}`, 5 stars (`RiStarLine`/`RiStarFill`), comment placeholder «Σχόλιο (προαιρετικά): ποιότητα, συνέπεια, επικοινωνία», button «Αποθήκευση». Calls `rateSupplier`.
- CancelRfq: title «Ακύρωση αιτήματος προσφοράς», body «Το αίτημα θα ακυρωθεί για όλους τους συνεργάτες.», danger button «Ακύρωση αιτήματος». Calls `cancelRfq`.

- [ ] **Step 1: Tests** `lib/work/dialog-guard.test.ts`: `dialogAvailable("forward-offer", faultWithOffers, mgr)` true; after `subjectFromContext` with a ctx containing a PENDING_CUSTOMER WO → false; `subjectFromContext` rebuilds flags from ctx (open RFQ with 1 SUBMITTED offer, 1 appointment).
- [ ] **Step 2: Run** `npx vitest run lib/work/dialog-guard.test.ts` → FAIL.
- [ ] **Step 3: Implement** guard + hook + host + button + toast + icons + the six dialogs.
- [ ] **Step 4: Run** tests → PASS; `npx tsc --noEmit`; `npx eslint components/work lib/work` → 0 errors in these files.
- [ ] **Step 5: Commit** `feat(work): useWorkActions hook, dialog host, actions button, assignment/status/comment/rating/cancel dialogs`.

---

### Task 6: Appointment, RFQ and work-order dialogs

**Files:**
- Create: `components/work/dialogs/AppointmentDialog.tsx`, `CreateRfqDialog.tsx`, `AddRfqSuppliersDialog.tsx`, `ForwardOfferDialog.tsx`, `WoRespondDialog.tsx`, `WoScheduleDialog.tsx`, `WoConfirmDialog.tsx`
- Modify: `components/work/WorkActionHost.tsx` (register the seven)
- Create: `lib/work/appointment.ts` (pure helpers) · Test: `lib/work/appointment.test.ts`

**Interfaces:**

```ts
// lib/work/appointment.ts
export function combineLocal(date: string, time: string): string | null;   // "2026-10-22" + "09:30" → ISO (local tz) or null when either empty/invalid
export function roundTo30(minutes: number | null | undefined, fallback: number): number;   // NaN/≤0 → fallback; else nearest 30, min 30
export const TIME_OPTIONS: string[];   // "06:00" … "21:30" in 30′ steps
```

Dialog behaviour (exact copy):
- Appointment: title «Ραντεβού», tabs «Ορισμός ραντεβού» / «Διαθεσιμότητα (slots)». Tab 1: date input, time select (`TIME_OPTIONS`), «Διάρκεια (λεπτά)» prefilled `ctx.fault.estimatedMinutes ?? 60`, checkbox «Παρουσία διαχειριστή» prefilled, button «Ορισμός ραντεβού» → `setRequestEstimate(id, duration, presence)` (only when changed) then `scheduleRequest(id, iso, duration)`. Tab 2: open slots list (`ctx.fault.slots` status OPEN; other side → «Κλείσιμο ραντεβού» (`bookSlot`), own side → trash (`removeSlot`)), add row (date + time) «Δήλωση διαθεσιμότητας» (`offerSlots`). Existing appointments listed below («Ραντεβού: dd/MM HH:mm – HH:mm»). Badge «Περιορισμένη πρόσβαση» when `restrictedAccess`.
- CreateRfq: reuse `RfqSupplierPicker` + the four fields of `rfq-panel.tsx:NewRfqForm` (deadline, «Ζητείται αυτοψία πριν την προσφορά», notes), button `Αποστολή σε N συνεργάτ{η|ες}`; result message via `sentMessage` (exported from rfq-panel → move to `lib/rfq-shared.ts` as `sentMessage` to avoid a client-component import).
- AddRfqSuppliers: picker with `excludeIds` = invited supplier ids of `ctx.rfqs` open RFQ; button «Αποστολή σε N επιπλέον» → `addRfqSuppliers(openRfqId, ids)`.
- ForwardOffer: offers = SUBMITTED offers of open RFQs; if > 1 a radio list «Συνεργάτης · ποσό + ΦΠΑ · αξιολόγηση»; then the form of `rfq-panel.tsx:OfferRow` (covered checkbox default `handledBy === "COMPANY"`, «Περιθώριο %», «Τιμή πελάτη (καθ.)», preview line, «Μήνυμα προς τον πελάτη (προαιρετικά)»), button «Ανάθεση χωρίς χρέωση» / «Αποστολή προσφοράς στον πελάτη» → `forwardOffer`.
- WoRespond: summary (number, supplier, `eur(customerPrice)` + ΦΠΑ, «ισχύει έως»), radio «Αποδοχή» / «Απόρριψη» (+ «Λόγος απόρριψης» when declining), textarea «Πώς συμφώνησε ο πελάτης;» placeholder «π.χ. τηλεφωνικά με κ. Παπαδόπουλο, 21/10 12:30», note «Η ενέργεια καταγράφεται στο ιστορικό με το όνομά σας.», button «Καταχώρηση» → `respondWorkOrder(id, accept, reason, { onBehalfNote })`.
- WoSchedule: title «Προγραμματισμός έργου», `datetime-local`, button «Ορισμός» → `scheduleWorkOrder`.
- WoConfirm: summary of completion (`completionNote`, media thumbnails), radio «Παραλαβή — η εργασία έγινε σωστά» / «Αμφισβήτηση — κάτι δεν πάει καλά» (+ textarea «Τι δεν έγινε σωστά;»), textarea «Πώς το επιβεβαίωσε ο πελάτης;», button «Καταχώρηση» → `confirmWorkOrder(id, ok, note, { onBehalfNote })`.

- [ ] **Step 1: Tests** for `combineLocal` (valid → ISO whose local time matches; empty → null), `roundTo30` (45 → 60; 0 → fallback; NaN → fallback; 20 → 30), `TIME_OPTIONS` length 32 starting "06:00" ending "21:30".
- [ ] **Step 2: Run** `npx vitest run lib/work/appointment.test.ts` → FAIL.
- [ ] **Step 3: Implement** helpers, move `sentMessage` to `lib/rfq-shared.ts` (re-export from rfq-panel for existing importers), the seven dialogs, register in the host.
- [ ] **Step 4: Run** tests → PASS; `npx tsc --noEmit`; eslint on `components/work`.
- [ ] **Step 5: Commit** `feat(work): appointment, RFQ, forward-offer and on-behalf work-order dialogs`.

---

### Task 7: Wire the Work center

**Files:**
- Modify: `app/(company)/admin/work/page.tsx` (viewer = `workActionViewer(scope.role, scope.userId, resolved.perms)` using `getEffectivePermissions`), `app/(company)/admin/work/WorkCenterClient.tsx` (:7-18 imports, :34-40 state, :100-127 actions, :180-210 table + modal)
- Modify: `lib/work/kpis.ts` only if `WorkViewer` type import changes (should not)
- Test: existing `lib/work/*.test.ts` stay green; `app/(company)/admin/work` has no unit tests (client)

**Interfaces:** `WorkCenterClient` prop `viewer: WorkActionViewer`. Inside: `const wa = useWorkActions({ viewer, where: "list" })`; `getRowActions={(r) => wa.rowActions(subjectFromWorkItem(r), fallbackFor(r))}` where `fallbackFor` = programme → [«Προβολή» → `r.href`], appointment → [«Άνοιγμα βλάβης» → `r.href`, «Ραντεβού…» → `wa.open("appointment", { kind: "fault", id: r.sourceId, status: "SCHEDULED", handledBy: "COMPANY", assigneeId: r.assigneeId, supplierId: null, flags: EMPTY_FLAGS })`]; `batchActions={wa.batchActions((rows) => rows.map(subjectFromWorkItem).filter(Boolean))}`; render `<wa.Host />` once. Delete the local assign modal, `assignTargets`, `assignee`, `rowActions`, `batchActions`, the `run` helper; keep the inline assignee `<select>` column (it calls `assignRequest` via `callAction` and `router.refresh` — keep as is).

- [ ] **Step 1:** Make the changes.
- [ ] **Step 2:** `npx tsc --noEmit`, `npx vitest run lib/work`, `npx eslint "app/(company)/admin/work"`.
- [ ] **Step 3:** Browser (dev-3002, logged-in pane): `/admin/work` → ⋯ on a fault row shows grouped menu; on a programme row only «Προβολή»; phone 375px → pills + «Ενέργειες (N)» sheet. Open «Ανάθεση σε υπάλληλο…» → dialog loads → **cancel**. Screenshot `after-work-menu-desktop.png`, `after-work-sheet-phone.png` to the scratchpad `shots/`.
- [ ] **Step 4: Commit** `feat(work-center): full per-row action menus and batch actions via useWorkActions`.

---

### Task 8: Wire Βλάβες list

**Files:**
- Modify: `app/(company)/admin/maintenance/page.tsx` (pass `viewer` built with `workActionViewer` + perms), `app/(company)/admin/maintenance/MaintenanceListClient.tsx` (:60-130)

**Interfaces:** new prop `viewer: WorkActionViewer`; `getRowActions={(r) => wa.rowActions(subjectFromFaultListItem(r))}`, `batchActions={wa.batchActions((rows) => rows.map(subjectFromFaultListItem))}`, `<wa.Host />`.

- [ ] **Step 1:** Implement.
- [ ] **Step 2:** `npx tsc --noEmit`; browser `/admin/maintenance` ⋯ menu on an open fault (desktop + phone), screenshot `after-maintenance-menu.png`.
- [ ] **Step 3: Commit** `feat(maintenance): per-row and batch work actions on the faults list`.

---

### Task 9: Work-order detail page + Συμβάσεις list

**Files:**
- Create: `app/(company)/admin/work-orders/[id]/page.tsx`, `app/(company)/admin/work-orders/[id]/WorkOrderDetailClient.tsx`, `docs/wiki/pages/admin-work-orders-detail.md`
- Modify: `app/(company)/admin/work-orders/page.tsx` (pass viewer), `WorkOrdersClient.tsx` (number link → `/admin/work-orders/${r.id}`; `getRowActions={(r) => wa.rowActions(subjectFromWorkOrderDTO(r))}`; `<wa.Host />`), `lib/rfq.ts` (add `loadWorkOrderDetail(id)`), `docs/wiki/pages/admin-work-orders.md` (step 1 text: «Προβολή» opens the contract page; actions in the ⋯ menu)

**Interfaces:**

```ts
// lib/rfq.ts
export async function loadWorkOrderDetail(id: string): Promise<{ wo: WorkOrderDTO & { customerName: string; buildingId: string; faultTitle: string | null; faultStatus: string | null; offerRating: number | null }; events: { id: string; createdAt: string; toStatus: string; note: string | null; byName: string | null }[] } | null>;
//  include: woInclude + customer { name } + maintenanceRequest { id, title, status } + offer { supplier rating via supplierRatingAvg if available else null };
//  events = maintenanceStatusEvent where requestId = wo.maintenanceRequestId AND note contains wo.number, orderBy createdAt desc, include byUser { name }.
```

Page: `requirePermission("work-orders", "view")`; MANAGER scope via `managedCustomerIds` (`notFound()` when the WO's `customerId` is outside); viewer via `workActionViewer`. Layout per spec §6.6 (back link «Πίσω στις συμβάσεις», header with `WO_STATUS_LABELS/COLORS` pill, `<ActionsButton subject={subjectFromWorkOrderDTO(wo)} …/>`, Kv grid copied from `rfq-panel.tsx:WorkOrderRow` (same labels), description + `customerMessage`, completion media, links «Σύμβαση Α (πελάτης)» / «Σύμβαση Β (συνεργάτης)» / «Άνοιγμα βλάβης», «Ιστορικό» list). `metadata.title = "Σύμβαση έργου"`.

Wiki frontmatter: `title: Σύμβαση έργου`, `route: /admin/work-orders/[id]`, `roles: [SUPER_ADMIN, ADMIN, MANAGER]`, `area: operations`, `summary`, 2 prompts, `related: [admin-work-orders, admin-maintenance-detail, admin-work-orders-detail-contract-side]`; sections «Τι βλέπετε εδώ», «Βήμα-βήμα» (Ενέργειες: αποδοχή/απόρριψη εκ μέρους πελάτη με σημείωση, προγραμματισμός, παραλαβή εκ μέρους πελάτη), «Συχνές ερωτήσεις».

- [ ] **Step 1:** Run `npx vitest run lib/help/coverage.test.ts` after creating the page but before the article → FAIL "Missing articles for: /admin/work-orders/[id]".
- [ ] **Step 2:** Implement loader, page, client, list changes, article.
- [ ] **Step 3:** `npx vitest run lib/help` → PASS; `npx tsc --noEmit`; browser: `/admin/work-orders` → number link → detail page renders, «Ενέργειες» opens (cancel); screenshot `after-work-order-detail.png`.
- [ ] **Step 4: Commit** `feat(work-orders): detail page with actions button; list menus; wiki article`.

---

### Task 10: Wire `/staff/rfq`

**Files:**
- Modify: `app/(company)/staff/rfq/page.tsx` (pass `viewer`), `RfqInvitationsClient.tsx` (:62-67 actions; remove `AddSuppliersModal` and its state; keep `NewRfqModal` and «Αποστολή ξανά»)

**Interfaces:** `actions(r) = [...(resendable ? [«Αποστολή ξανά»] : []), ...wa.rowActions(subjectFromRfqInvitationRow(r))]` — the resend action gets `section: "offers"`; `<wa.Host />`.

- [ ] **Step 1:** Implement; `npx tsc --noEmit`; browser `/staff/rfq` ⋯ menu; screenshot `after-rfq-menu.png`.
- [ ] **Step 2: Commit** `feat(rfq): shared work actions on the invitations board`.

---

### Task 11: Fault detail page — «Ενέργειες» button, remove the old card, panels call the shared dialogs

**Files:**
- Create: `components/maintenance/FaultDetailClient.tsx`
- Modify: `app/(company)/admin/maintenance/[id]/page.tsx` (render `FaultDetailClient` with `detail`, `viewer: WorkActionViewer`, `rfqPanel`, `picker`), `components/maintenance/request-detail.tsx` (remove :147-216 actions card and :218-236 rating card; appointment card :239-335 → list only + «Ραντεβού…» button; header gets `actions` slot), `components/maintenance/rfq-panel.tsx` (replace inline forms with buttons calling `wa.open`; delete `NewRfqForm`, the add-suppliers picker block, the forward form in `OfferRow`, the datetime in `WorkOrderRow`; add on-behalf buttons on `WorkOrderRow`), `docs/wiki/pages/admin-maintenance-detail.md`

**Interfaces:**

```ts
// FaultDetailClient.tsx ("use client")
export function FaultDetailClient(props: { detail: FaultDetail; viewer: WorkActionViewer; employeesCount: number; rfqPanel: { rfqs: RfqDTO[]; workOrders: WorkOrderDTO[]; defaults: {...} } | null; picker: RfqPickerData; canRfqView: boolean }): JSX.Element;
//  const wa = useWorkActions({ viewer, where: "detail" }); const subject = subjectFromFaultDetail(detail, rfqPanel);
//  renders <RequestDetail request viewer actions={<ActionsButton subject viewer api={wa} />} onOpen={(d) => wa.open(d, subject)} /> + <RfqPanel … onOpen={(d) => wa.open(d, subject)} /> + <wa.Host />
// RequestDetail new props: actions?: React.ReactNode; onOpen?: (dialog: WorkDialog) => void   (employees/suppliers/preferredSupplierId props removed)
// RfqPanel new prop: onOpen: (dialog: WorkDialog) => void; removed: picker, defaults (dialogs load their own) — keep `canCreate`
```

The portal/occupant consumers of `RequestDetail` (grep `RequestDetail` under `app/(customer)`) keep working: `actions`/`onOpen` are optional; the removed cards were staff-only (`viewer.canAssign`/`isStaff`) so occupants lose nothing — verify with `grep -rn "RequestDetail" app components`.

Wiki `admin-maintenance-detail.md`: rewrite «Τι βλέπετε εδώ» and «Βήμα-βήμα» around the «Ενέργειες» button (list the menu items by section), keep FAQ; add «Ραντεβού σε κάθε βλάβη» and «Εκ μέρους πελάτη» paragraphs.

- [ ] **Step 1:** Implement.
- [ ] **Step 2:** `npx tsc --noEmit`; `npx vitest run lib/help`; browser `/admin/maintenance/<id>` (pick an existing fault from the list): header «Ενέργειες» opens the grouped menu; «Ραντεβού…» dialog opens → cancel; RfqPanel buttons open dialogs → cancel; phone 375px uses the sheet. Screenshots `after-fault-detail-actions.png`, `after-fault-detail-phone.png`. Also open one `/portal/maintenance/<id>` via View-as PROPERTY_ADMIN if a user exists, else skip and note it.
- [ ] **Step 3: Commit** `feat(maintenance): fault page driven by the actions button; panels open the shared dialogs`.

---

### Task 12: Wiki, memory, checks, hand-over

**Files:**
- Modify: `docs/wiki/pages/admin-work.md` (row menu sections, batch, phone sheet), `admin-maintenance.md` (⋯ menu + batch), `staff-rfq.md` (menu), `docs/wiki/pages/staff-home.md` / `admin-home.md` only if they describe the old fault actions (grep «Ανάθεση σε υπάλληλο»)
- Modify: `~/.claude/projects/-Volumes-EXTERNALSSD-propertymanagement/memory/project_admin_dashboards.md` (append: work actions SHIPPED, sub-projects 2–5 pending, on-behalf rule, appointments everywhere, WO detail page)
- Create: hand-over note `/Users/kozyris/Library/Application Support/Claude/side-session-notes/local_d495e2b3-12a3-4067-8413-158ebae5f72d/work-actions-handover.md`

- [ ] **Step 1:** Wiki edits; `npx vitest run lib/help` → PASS.
- [ ] **Step 2:** Full checks: `npx tsc --noEmit` (expect exactly the 9 known errors), `npm run lint` (count ≤ baseline 339; 0 in touched files), `npm run test` (only the 2 known failures).
- [ ] **Step 3:** Before/after screenshot set in scratchpad `shots/` (before: taken in Task 7 step 3 first visit — if missed, use the previous session's `after-work-desktop-superadmin.png` as "before"); View-as ADMIN and MANAGER on `/admin/work` and `/admin/work-orders/<id>`; exit View-as via «Έξοδος».
- [ ] **Step 4:** Memory file + hand-over note (commits, checks, what was verified in the browser, what was not, follow-ups incl. sub-projects 2–5 and the EMPLOYEE `maintenance:edit` gap).
- [ ] **Step 5: Commit** `docs(wiki): work actions — menus, actions button, work-order page`.
