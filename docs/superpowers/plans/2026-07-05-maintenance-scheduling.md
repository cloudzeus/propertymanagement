# Maintenance Scheduling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add preventive/scheduled maintenance to buildings — recurring schedule, email reminders (managed/package-aware recipients), completion logging with certificate documents, and a history view.

**Architecture:** Extend the existing `RecurringTask` model into the maintenance schedule (adds `kind`, `inServicePackage`, `reminderDaysBefore`, `reminderSentAt`). A new `MaintenanceLog` records each completion (cost, notes, optional `BuildingFile` certificate). A Coolify daily cron hits an idempotent protected route that selects tasks due for reminder and emails the correct recipients (company employees vs PROPERTY_ADMIN) per a pure `pickReminderRecipients` helper. UI extends `CalendarPanel` and adds a Maintenance history tab; PROPERTY_ADMIN gets a scoped portal surface.

**Tech Stack:** Next.js 16.2 (server components + server actions), Prisma 7/PostgreSQL, Mailgun (`lib/mailgun.ts`), Bunny CDN (via `app/actions/building-files.ts`), vitest.

**Conventions (must follow):**
- Import `db` from `@/lib/db`. Import enums from `@/lib/prisma/enums`.
- **Do NOT run `prisma migrate dev`** (causes Announcement drift → reset). Use `migrate diff` + `migrate deploy` (see Task 1).
- Icons: `react-icons/ri` `*Line` variants. No emoji.
- Greek UI strings, matching existing panels.

---

### Task 1: Schema — extend RecurringTask, add MaintenanceLog, MAINTENANCE file category

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add `MAINTENANCE` to `BuildingFileCategory`**

In `prisma/schema.prisma`, the enum near line 714:

```prisma
enum BuildingFileCategory {
  PLANS
  PHOTOS
  DOCUMENTS
  CERTIFICATES
  RECEIPT
  PAYMENT
  MAINTENANCE
  OTHER
}
```

- [ ] **Step 2: Add `MaintenanceKind` enum** (place directly above `model RecurringTask`)

```prisma
enum MaintenanceKind {
  GENERAL
  ELEVATOR
  BOILER
  FIRE_SAFETY
  HVAC
  ELECTRICAL
  PLUMBING
  OTHER
}
```

- [ ] **Step 3: Extend `RecurringTask`** — add fields inside the model (after `active`):

```prisma
  kind               MaintenanceKind @default(GENERAL)
  inServicePackage   Boolean  @default(false)
  reminderDaysBefore Int      @default(7)
  reminderSentAt     DateTime?
  logs               MaintenanceLog[]
```

- [ ] **Step 4: Add `MaintenanceLog` model** (place after `model RecurringTask { ... }`)

```prisma
model MaintenanceLog {
  id               String        @id @default(cuid())
  recurringTaskId  String
  recurringTask    RecurringTask @relation(fields: [recurringTaskId], references: [id], onDelete: Cascade)
  buildingId       String
  building         Building      @relation(fields: [buildingId], references: [id], onDelete: Cascade)
  performedAt      DateTime
  performedById    String?
  performedBy      User?         @relation("maintenancePerformedBy", fields: [performedById], references: [id], onDelete: SetNull)
  cost             Decimal?      @db.Decimal(10, 2)
  notes            String?
  documentFileId   String?
  documentFile     BuildingFile? @relation("maintenanceDocument", fields: [documentFileId], references: [id], onDelete: SetNull)
  createdAt        DateTime      @default(now())

  @@index([recurringTaskId])
  @@index([buildingId])
}
```

- [ ] **Step 5: Add back-relations**

On `model Building` (near line 674, after `recurringTasks`):
```prisma
  maintenanceLogs       MaintenanceLog[]
```
On `model User` (near the maintenance relations, ~line 171):
```prisma
  performedMaintenance MaintenanceLog[] @relation("maintenancePerformedBy")
```
On `model BuildingFile` (after `paymentLinks`):
```prisma
  maintenanceLogs MaintenanceLog[] @relation("maintenanceDocument")
```

- [ ] **Step 6: Generate a migration WITHOUT touching the dev DB, then deploy**

Run:
```bash
npx prisma migrate diff \
  --from-schema-datamodel prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma \
  --script > /dev/null; \
npx prisma migrate dev --create-only --name maintenance_scheduling --skip-generate
```
If `migrate dev --create-only` prompts about drift, STOP and ask the user. Otherwise it only writes the migration SQL file (no apply). Then:
```bash
npx prisma migrate deploy && npx prisma generate
```
Expected: migration `*_maintenance_scheduling` applied, client regenerated.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(maintenance): schema — RecurringTask fields, MaintenanceLog, MAINTENANCE category"
```

---

### Task 2: Reminder recipient logic (pure, tested)

**Files:**
- Create: `lib/maintenance.ts`
- Test: `lib/maintenance.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { pickReminderEmails, isReminderDue } from "./maintenance";

const companyEmployees = ["emp1@co.gr", "emp2@co.gr"];
const managers = ["mgr@owner.gr"];

describe("pickReminderEmails", () => {
  it("managed + in package → company employees", () => {
    expect(pickReminderEmails({ managed: true, inServicePackage: true }, companyEmployees, managers))
      .toEqual(companyEmployees);
  });
  it("managed + out of package → managers", () => {
    expect(pickReminderEmails({ managed: true, inServicePackage: false }, companyEmployees, managers))
      .toEqual(managers);
  });
  it("not managed → managers", () => {
    expect(pickReminderEmails({ managed: false, inServicePackage: true }, companyEmployees, managers))
      .toEqual(managers);
  });
});

describe("isReminderDue", () => {
  const today = new Date("2026-07-05T09:00:00Z");
  it("due when today >= nextDueDate - reminderDaysBefore and not yet sent", () => {
    expect(isReminderDue({ nextDueDate: new Date("2026-07-10"), reminderDaysBefore: 7, reminderSentAt: null }, today)).toBe(true);
  });
  it("not due when still before the reminder window", () => {
    expect(isReminderDue({ nextDueDate: new Date("2026-07-20"), reminderDaysBefore: 7, reminderSentAt: null }, today)).toBe(false);
  });
  it("not due when already sent for this cycle", () => {
    expect(isReminderDue({ nextDueDate: new Date("2026-07-10"), reminderDaysBefore: 7, reminderSentAt: new Date("2026-07-04") }, today)).toBe(false);
  });
  it("no nextDueDate → never due", () => {
    expect(isReminderDue({ nextDueDate: null, reminderDaysBefore: 7, reminderSentAt: null }, today)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/maintenance.test.ts`
Expected: FAIL — module `./maintenance` not found.

- [ ] **Step 3: Implement `lib/maintenance.ts`**

```ts
/** Pure helpers for maintenance reminders — no DB access, unit-testable. */

export function pickReminderEmails(
  task: { managed: boolean; inServicePackage: boolean },
  companyEmployeeEmails: string[],
  managerEmails: string[],
): string[] {
  if (task.managed && task.inServicePackage) return companyEmployeeEmails;
  return managerEmails;
}

/** The reminder window opens `reminderDaysBefore` days before nextDueDate.
 *  reminderSentAt clears on completion, so a non-null value < window-open still
 *  belongs to the PREVIOUS cycle only if it predates the window; we treat any
 *  reminderSentAt on/after window-open as "already sent this cycle". */
export function isReminderDue(
  t: { nextDueDate: Date | null; reminderDaysBefore: number; reminderSentAt: Date | null },
  today: Date,
): boolean {
  if (!t.nextDueDate) return false;
  const windowOpen = new Date(t.nextDueDate);
  windowOpen.setDate(windowOpen.getDate() - t.reminderDaysBefore);
  if (today < windowOpen) return false;
  if (t.reminderSentAt && t.reminderSentAt >= windowOpen) return false;
  return true;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/maintenance.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/maintenance.ts lib/maintenance.test.ts
git commit -m "feat(maintenance): pure reminder recipient + due-date helpers"
```

---

### Task 3: Extend recurring-tasks actions with the new fields

**Files:**
- Modify: `app/actions/recurring-tasks.ts`

- [ ] **Step 1: Extend `TaskInput` and the create/update payloads**

At the top of `app/actions/recurring-tasks.ts`, add the kind list and extend the type:

```ts
const KINDS = ["GENERAL","ELEVATOR","BOILER","FIRE_SAFETY","HVAC","ELECTRICAL","PLUMBING","OTHER"] as const;
export type MaintenanceKind = (typeof KINDS)[number];
export type TaskInput = {
  title: string; frequency: TaskFrequency; nextDueDate?: string | null;
  vendor?: string | null; notes?: string | null; active?: boolean;
  kind?: MaintenanceKind; inServicePackage?: boolean; reminderDaysBefore?: number;
};
```

- [ ] **Step 2: Include the fields in `createRecurringTask`'s `data` object**

Add to the `db.recurringTask.create({ data: { ... } })` block:
```ts
      kind: (KINDS.includes(data.kind as any) ? data.kind : "GENERAL") as any,
      inServicePackage: data.inServicePackage ?? false,
      reminderDaysBefore: Number.isFinite(data.reminderDaysBefore) ? Number(data.reminderDaysBefore) : 7,
```

- [ ] **Step 3: Include the fields in `updateRecurringTask`'s conditional `data`**

Add these spreads alongside the existing ones:
```ts
      ...(data.kind !== undefined ? { kind: (KINDS.includes(data.kind as any) ? data.kind : "GENERAL") as any } : {}),
      ...(data.inServicePackage !== undefined ? { inServicePackage: data.inServicePackage } : {}),
      ...(data.reminderDaysBefore !== undefined ? { reminderDaysBefore: Number(data.reminderDaysBefore) } : {}),
```

- [ ] **Step 4: Reset `reminderSentAt` in `markTaskDone`** (so the next cycle re-sends)

In `markTaskDone`, change the update to:
```ts
  await db.recurringTask.update({ where: { id }, data: { lastDoneDate: new Date(), nextDueDate: next, reminderSentAt: null } });
```

- [ ] **Step 5: Typecheck & commit**

Run: `npx tsc --noEmit`
Expected: no new errors in this file.
```bash
git add app/actions/recurring-tasks.ts
git commit -m "feat(maintenance): recurring-task actions carry kind/package/reminder fields"
```

---

### Task 4: Completion action — MaintenanceLog + optional certificate + history query

**Files:**
- Create: `app/actions/maintenance-logs.ts`

- [ ] **Step 1: Implement the completion action**

```ts
"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { uploadBuildingFile } from "./building-files";

const FREQ_ADVANCE: Record<string, (d: Date) => Date> = {
  WEEKLY: (d) => { const x = new Date(d); x.setDate(x.getDate() + 7); return x; },
  MONTHLY: (d) => { const x = new Date(d); x.setMonth(x.getMonth() + 1); return x; },
  QUARTERLY: (d) => { const x = new Date(d); x.setMonth(x.getMonth() + 3); return x; },
  SEMIANNUAL: (d) => { const x = new Date(d); x.setMonth(x.getMonth() + 6); return x; },
  ANNUAL: (d) => { const x = new Date(d); x.setFullYear(x.getFullYear() + 1); return x; },
  CUSTOM: (d) => d,
};

async function requireStaff() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const u = await db.user.findUnique({ where: { id: session.user.id as string }, select: { id: true, role: true } });
  if (!["SUPER_ADMIN","ADMIN","MANAGER","EMPLOYEE","PROPERTY_ADMIN"].includes(u?.role ?? "")) throw new Error("Forbidden");
  return u!;
}

/** Complete a maintenance task: optional certificate upload → MaintenanceLog → advance nextDueDate.
 *  `formData` may contain a `file` (certificate). Scalar fields passed via `data`. */
export async function completeMaintenance(
  taskId: string,
  data: { performedAt: string; cost?: string | null; notes?: string | null },
  formData?: FormData,
) {
  const user = await requireStaff();
  const task = await db.recurringTask.findUnique({
    where: { id: taskId },
    select: { id: true, buildingId: true, frequency: true, nextDueDate: true },
  });
  if (!task) return { error: "Δεν βρέθηκε" };

  let documentFileId: string | undefined;
  const file = formData?.get("file");
  if (file && file instanceof File && file.size > 0) {
    const fd = new FormData();
    fd.set("buildingId", task.buildingId);
    fd.set("category", "MAINTENANCE");
    fd.set("file", file);
    const up = await uploadBuildingFile(fd);
    if ("error" in up && up.error) return { error: up.error };
    documentFileId = (up as { file: { id: string } }).file.id;
  }

  await db.maintenanceLog.create({
    data: {
      recurringTaskId: task.id,
      buildingId: task.buildingId,
      performedAt: new Date(data.performedAt),
      performedById: user.id,
      cost: data.cost?.trim() ? data.cost.trim() : null,
      notes: data.notes?.trim() ? data.notes.trim() : null,
      documentFileId,
    },
  });

  const base = task.nextDueDate ?? new Date();
  const next = task.frequency === "CUSTOM" ? task.nextDueDate : FREQ_ADVANCE[task.frequency](base);
  await db.recurringTask.update({
    where: { id: task.id },
    data: { lastDoneDate: new Date(), nextDueDate: next, reminderSentAt: null },
  });

  revalidatePath(`/super-admin/buildings/${task.buildingId}`);
  return { ok: true };
}

export async function listMaintenanceHistory(buildingId: string) {
  await requireStaff();
  const rows = await db.maintenanceLog.findMany({
    where: { buildingId },
    orderBy: { performedAt: "desc" },
    select: {
      id: true, performedAt: true, cost: true, notes: true,
      recurringTask: { select: { title: true, kind: true } },
      performedBy: { select: { name: true, email: true } },
      documentFile: { select: { url: true, name: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    performedAt: r.performedAt.toISOString(),
    title: r.recurringTask?.title ?? "—",
    kind: r.recurringTask?.kind ?? "GENERAL",
    cost: r.cost ? r.cost.toString() : null,
    notes: r.notes,
    performedBy: r.performedBy?.name ?? r.performedBy?.email ?? null,
    documentUrl: r.documentFile?.url ?? null,
    documentName: r.documentFile?.name ?? null,
  }));
}
```

Note: confirm `uploadBuildingFile`'s success shape in `app/actions/building-files.ts` (it returns `{ file: { id, ... } }`). Adjust the destructuring if the field name differs.

- [ ] **Step 2: Typecheck & commit**

Run: `npx tsc --noEmit`
Expected: no new errors.
```bash
git add app/actions/maintenance-logs.ts
git commit -m "feat(maintenance): completeMaintenance + history query"
```

---

### Task 5: Cron reminder route (idempotent, protected)

**Files:**
- Create: `app/api/cron/maintenance-reminders/route.ts`

- [ ] **Step 1: Implement the route**

```ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { pickReminderEmails, isReminderDue } from "@/lib/maintenance";
import { sendNotificationEmail } from "@/lib/mailgun";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const today = new Date();

  const tasks = await db.recurringTask.findMany({
    where: { active: true, nextDueDate: { not: null } },
    select: {
      id: true, title: true, kind: true, inServicePackage: true,
      nextDueDate: true, reminderDaysBefore: true, reminderSentAt: true,
      building: {
        select: {
          id: true, name: true, propertyId: true,
          managementAssignments: { select: { user: { select: { email: true, role: true } } } },
          property: { select: { managementAssignments: { select: { user: { select: { email: true, role: true } } } } } },
        },
      },
    },
  });

  let sent = 0;
  for (const t of tasks) {
    if (!isReminderDue(t, today)) continue;

    const assignments = [
      ...t.building.managementAssignments.map((a) => a.user),
      ...(t.building.property?.managementAssignments.map((a) => a.user) ?? []),
    ];
    const managed = assignments.length > 0;
    const companyEmails = assignments
      .filter((u) => ["SUPER_ADMIN","ADMIN","MANAGER","EMPLOYEE"].includes(u.role))
      .map((u) => u.email).filter(Boolean) as string[];
    const managerEmails = assignments
      .filter((u) => u.role === "PROPERTY_ADMIN")
      .map((u) => u.email).filter(Boolean) as string[];

    const recipients = [...new Set(pickReminderEmails({ managed, inServicePackage: t.inServicePackage }, companyEmails, managerEmails))];
    if (recipients.length === 0) continue;

    const due = t.nextDueDate!.toLocaleDateString("el-GR");
    await Promise.all(recipients.map((email) =>
      sendNotificationEmail(email, `Υπενθύμιση συντήρησης — ${t.building.name}`,
        `Η συντήρηση «${t.title}» είναι προγραμματισμένη για ${due}.`)
    ));
    await db.recurringTask.update({ where: { id: t.id }, data: { reminderSentAt: today } });
    sent++;
  }

  return NextResponse.json({ ok: true, checked: tasks.length, sent });
}
```

Note: verify the relation name on `Building` for management assignments (`managementAssignments`) and on `Property`. Grep `ManagementAssignment` back-relations in `schema.prisma` and adjust the `select` if the field is named differently.

- [ ] **Step 2: Verify manually**

Run the dev server, then:
```bash
curl -s -H "x-cron-secret: $CRON_SECRET" http://localhost:3000/api/cron/maintenance-reminders
```
Expected: JSON `{ ok: true, checked: N, sent: M }`. Without the header → 401.

- [ ] **Step 3: Document the Coolify cron**

Add to the route file top a comment:
```ts
// Coolify scheduled task (daily): curl -H "x-cron-secret: $CRON_SECRET" https://property.dgsmart.gr/api/cron/maintenance-reminders
// Set CRON_SECRET in Coolify env.
```

- [ ] **Step 4: Commit**

```bash
git add app/api/cron/maintenance-reminders/route.ts
git commit -m "feat(maintenance): idempotent daily reminder cron route"
```

---

### Task 6: CalendarPanel — new fields + completion modal

**Files:**
- Modify: `app/(company)/super-admin/buildings/[id]/CalendarPanel.tsx`

- [ ] **Step 1: Extend `TaskRow` type and the imports**

Add to `TaskRow`: `kind: string; inServicePackage: boolean; reminderDaysBefore: number;`.
Import `completeMaintenance` from `@/app/actions/maintenance-logs` and a `MaintenanceKind` list:
```ts
const KIND_OPTS = [
  { value: "GENERAL", label: "Γενική" }, { value: "ELEVATOR", label: "Ανελκυστήρας" },
  { value: "BOILER", label: "Λέβητας/Καυστήρας" }, { value: "FIRE_SAFETY", label: "Πυρασφάλεια" },
  { value: "HVAC", label: "Κλιματισμός" }, { value: "ELECTRICAL", label: "Ηλεκτρολογικά" },
  { value: "PLUMBING", label: "Υδραυλικά" }, { value: "OTHER", label: "Άλλο" },
];
```

- [ ] **Step 2: Add the three fields to `TaskModal`'s form**

In `TaskModal`, add local state for `kind`, `inServicePackage`, `reminderDaysBefore` (init from `editing`), render a `FieldSelect` for `kind` (options `KIND_OPTS`), a checkbox for `inServicePackage` (label «Εντός πακέτου υπηρεσιών»), and a `FieldInput type="number"` for `reminderDaysBefore` (label «Υπενθύμιση (ημέρες πριν)»). Pass all three into the `createRecurringTask` / `updateRecurringTask` payloads.

- [ ] **Step 3: Replace the plain `done()` with a completion modal**

Change the «Ολοκλήρωση» button to open a `CompleteModal` instead of calling `markTaskDone`. Add:
```tsx
function CompleteModal({ task, onClose, onDone }: { task: TaskRow; onClose: () => void; onDone: () => void }) {
  const [pending, start] = useTransition();
  const [performedAt, setPerformedAt] = useState(new Date().toISOString().slice(0, 10));
  const [cost, setCost] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  function submit() {
    start(async () => {
      const fd = new FormData();
      if (file) fd.set("file", file);
      await completeMaintenance(task.id, { performedAt, cost, notes }, fd);
      onDone();
    });
  }
  return (
    <Modal open onClose={onClose} title="Ολοκλήρωση συντήρησης" width={500}
      footer={<button onClick={submit} disabled={pending}>Καταχώριση</button>}>
      <FormField label="Ημερομηνία"><FieldInput type="date" value={performedAt} onChange={(e) => setPerformedAt(e.target.value)} /></FormField>
      <FormField label="Κόστος (€)"><FieldInput type="number" value={cost} onChange={(e) => setCost(e.target.value)} /></FormField>
      <FormField label="Σημειώσεις"><FieldTextarea value={notes} onChange={(e) => setNotes(e.target.value)} /></FormField>
      <FormField label="Πιστοποιητικό (προαιρετικό)"><input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></FormField>
    </Modal>
  );
}
```
Wire a `completing` state in `CalendarPanel` to render `<CompleteModal>` and `router.refresh()` on done. Keep the modal styling consistent with the existing `TaskModal` (match its footer/button markup).

- [ ] **Step 4: Update the query that feeds `tasks`** so the new columns are selected. In the server page/loader that builds `TaskRow[]` (grep for `recurringTask.findMany` under `app/(company)/super-admin/buildings/[id]/`), add `kind`, `inServicePackage`, `reminderDaysBefore` to the `select`.

- [ ] **Step 5: Typecheck, run, verify**

Run: `npx tsc --noEmit` (no new errors). Then load a building → Ημερολόγιο tab → create a maintenance task with kind/package/reminder, then «Ολοκλήρωση» with a file. Confirm no console errors and the task's `nextDueDate` advances.

- [ ] **Step 6: Commit**

```bash
git add "app/(company)/super-admin/buildings/[id]"
git commit -m "feat(maintenance): calendar form fields + completion modal"
```

---

### Task 7: Maintenance history tab (DataTable)

**Files:**
- Create: `app/(company)/super-admin/buildings/[id]/MaintenanceTab.tsx`
- Modify: `app/(company)/super-admin/buildings/[id]/BuildingDashboard.tsx`
- Modify: `app/(company)/super-admin/buildings/[id]/page.tsx`

- [ ] **Step 1: Load history in the server page** — in `page.tsx`, call `listMaintenanceHistory(building.id)` and pass the rows into `BuildingDashboard` as a `maintenanceHistory` prop.

- [ ] **Step 2: Add the tab entry** — in `BuildingDashboard.tsx`, add to `TABS`:
```ts
{ key: "maintenance", label: "Συντηρήσεις", icon: RiToolsLine, badge: (k) => k.recurringTasks || undefined },
```
Add `"maintenance"` to `TabKey`, import `RiToolsLine`, and render `: tab === "maintenance" ? (<MaintenanceTab rows={maintenanceHistory} />)`.

- [ ] **Step 3: Implement `MaintenanceTab.tsx`** using the shared `DataTable` (`components/ui/data-table.tsx`) with columns: Ημερομηνία (`performedAt`, formatted `el-GR`), Τύπος (`kind` → Greek label via a map), Τίτλος (`title`), Ποιος (`performedBy`), Κόστος (`cost` + « €»), Πιστοποιητικό (link to `documentUrl` with `RiFileDownloadLine`, or «—»). Sortable by `performedAt` and filterable by `kind`, matching how other tabs use `DataTable` (grep an existing usage, e.g. `FilesPanel` or an expenses tab, for the exact prop shape).

- [ ] **Step 4: Typecheck, verify, commit**

Run: `npx tsc --noEmit`. Load the building → Συντηρήσεις tab → confirm the completed row from Task 6 appears with a working certificate link.
```bash
git add "app/(company)/super-admin/buildings/[id]"
git commit -m "feat(maintenance): building history tab"
```

---

### Task 8: PROPERTY_ADMIN portal surface

**Files:**
- Create: `app/(customer)/portal/maintenance/page.tsx`
- Reuse: `CalendarPanel`, `MaintenanceTab`, existing portal layout

- [ ] **Step 1: Scope the buildings** — in the page (server component), get the effective session, then load only buildings the user manages:
```ts
const assignments = await db.managementAssignment.findMany({
  where: { userId, role: "PROPERTY_ADMIN" },
  select: { buildingId: true, propertyId: true },
});
```
Resolve building IDs (direct `buildingId`, plus buildings under any assigned `propertyId`). If none → render an empty state «Δεν διαχειρίζεστε κτήρια».

- [ ] **Step 2: Render per building** — for each managed building, load its `recurringTasks` (with the new fields) and `listMaintenanceHistory`, and render `CalendarPanel` + `MaintenanceTab`. Reuse the same components; they already call the shared server actions which enforce `requireStaff` (PROPERTY_ADMIN is allowed).

- [ ] **Step 3: Add ownership guard to the write actions** — in `app/actions/recurring-tasks.ts` and `maintenance-logs.ts`, after `requireStaff`, if the user's role is `PROPERTY_ADMIN`, verify the target building is in their assignments before mutating; otherwise `throw new Error("Forbidden")`. Add a shared helper:
```ts
async function assertBuildingAccess(userId: string, role: string, buildingId: string) {
  if (["SUPER_ADMIN","ADMIN","MANAGER","EMPLOYEE"].includes(role)) return;
  const b = await db.building.findFirst({
    where: {
      id: buildingId,
      OR: [
        { managementAssignments: { some: { userId } } },
        { property: { managementAssignments: { some: { userId } } } },
      ],
    },
    select: { id: true },
  });
  if (!b) throw new Error("Forbidden");
}
```
Call it in `createRecurringTask`, `updateRecurringTask` (resolve buildingId from the row first), `markTaskDone`, `deleteRecurringTask`, and `completeMaintenance`. This enforces data isolation (hard requirement).

- [ ] **Step 4: Add portal nav link** — add «Συντηρήσεις» to the portal navigation (grep the portal `SidebarNav`/menu for where links are declared) pointing to `/portal/maintenance`, icon `RiToolsLine`.

- [ ] **Step 5: Typecheck, verify, commit**

Run: `npx tsc --noEmit`. Log in as a PROPERTY_ADMIN test user (see `TEST_USERS_GUIDE.md`), open `/portal/maintenance`, create + complete a maintenance task on an owned building, and confirm a building NOT owned is inaccessible.
```bash
git add "app/(customer)/portal/maintenance" app/actions
git commit -m "feat(maintenance): PROPERTY_ADMIN portal surface + ownership guards"
```

---

## Self-Review Notes

- **Spec coverage:** recurring schedule (Task 1,3,6) ✓; managed/package-aware reminders (Task 2,5) ✓; email + calendar (Task 5,6) ✓; reminder period + days-before (Task 1,3,5) ✓; completion certificate document (Task 4,6) ✓; cost (Task 1,4,7) ✓; history view (Task 7) ✓; manager surface + data isolation (Task 8) ✓; assignment-to-collaborator explicitly out of scope ✓.
- **Type consistency:** `pickReminderEmails`/`isReminderDue` signatures match between Task 2 and Task 5. `completeMaintenance(taskId, data, formData)` signature matches between Task 4 and Task 6. `TaskRow` extra fields match Task 1 schema.
- **Verify-before-build hooks:** Tasks 5 & 6 include grep-and-confirm notes for the `ManagementAssignment` relation name and `uploadBuildingFile` return shape, since those weren't fully inspected while planning.
