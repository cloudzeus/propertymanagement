# Managed Items → Maintenance → Obligations & Calendar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let company roles assign managed items to a building **or a common area** with a quantity, attach a **maintenance schedule** to each item, view a company-wide **obligations dashboard** for managed buildings, and see those schedules on the **staff calendar** — with EMPLOYEE able to reach the new surfaces.

**Architecture:** Additive nullable FKs connect `ManagedItem → CommonArea` and `RecurringTask → ManagedItem` (schedule lives on the item). The existing `RecurringTask`/`MaintenanceLog` engine (due-date advancement, reminders cron) is reused untouched. Two new server-only data modules (`lib/dashboard/managed-buildings.ts`, `lib/dashboard/maintenance-calendar.ts`) aggregate across managed buildings; a new `/super-admin/managed-buildings` page renders them; the existing `/staff/calendar` gains a second, colour-coded event type. Access widens through a new `managed-buildings` RBAC module only — the building-caps layer already grants EMPLOYEE (a `STAFF_ROLE`) `manageManagedItems`/`manageMaintenance`.

**Tech Stack:** Next.js 16 App Router (server components + server actions), Prisma 7 / PostgreSQL (custom client in `lib/prisma`), Auth.js v5, Tailwind 4 tokens (Orithon), react-icons/ri, vitest.

**Spec:** `docs/superpowers/specs/2026-07-21-managed-items-maintenance-obligations-design.md`

**Conventions (must follow):**
- Do **NOT** run `prisma migrate dev` (Announcement drift → DB reset). Generate a SQL diff and apply with `migrate deploy` (see Task 1).
- Import Prisma enums from `@/lib/prisma/enums`; use the `db` client from `@/lib/db`.
- Icons: `react-icons/ri` `*Line` variants only. No emoji.
- Greek UI copy. Inline styles with `var(--…)` tokens, matching existing panels.

---

## File map

**Schema / migration**
- Modify `prisma/schema.prisma` — 3 additive relations.
- Create `prisma/migrations/<ts>_managed_item_area_and_task_link/migration.sql`.

**RBAC**
- Modify `lib/rbac/registry.ts` — new `managed-buildings` module + role defaults.
- Create `lib/rbac/registry.managed-buildings.test.ts` — defaults assertions.

**Server actions / loaders**
- Modify `app/actions/managed-items.ts` — persist/validate `commonAreaId`.
- Modify `app/actions/recurring-tasks.ts` — accept/validate `managedItemId`.
- Modify `lib/building/dashboard-data.ts` — load common areas + each item's schedule.

**Assignment UI**
- Modify `components/building/ManagedItemsPanel.tsx` — CommonArea select + inline schedule.

**Calendar**
- Create `lib/dashboard/maintenance-calendar.ts` — occurrence projection + feed.
- Create `lib/dashboard/maintenance-calendar.test.ts` — projection unit tests.
- Modify `app/(company)/staff/calendar/page.tsx` — load + merge maintenance events.
- Modify `app/(company)/staff/calendar/DemoCalendarClient.tsx` — 2nd event type + filter.

**Obligations page**
- Create `lib/dashboard/managed-buildings.ts` — aggregation + status classifier.
- Create `lib/dashboard/managed-buildings.test.ts` — classifier unit tests.
- Create `app/(company)/super-admin/managed-buildings/page.tsx` — server page.
- Create `app/(company)/super-admin/managed-buildings/ManagedBuildingsClient.tsx` — UI.

---

## Task 1: Schema + migration (additive FKs)

**Files:**
- Modify: `prisma/schema.prisma` (models `ManagedItem`, `RecurringTask`, `CommonArea`)
- Create: `prisma/migrations/<ts>_managed_item_area_and_task_link/migration.sql`

- [ ] **Step 1: Add `commonAreaId` + relation to `ManagedItem`**

In `prisma/schema.prisma`, inside `model ManagedItem`, after the `notes String?` line (around line 1139) add:

```prisma
  commonAreaId          String?
  commonArea            CommonArea? @relation(fields: [commonAreaId], references: [id], onDelete: SetNull)
  tasks                 RecurringTask[]
```

And add to the existing `@@index` block for the model:

```prisma
  @@index([commonAreaId])
```

- [ ] **Step 2: Add `managedItemId` + relation to `RecurringTask`**

Inside `model RecurringTask`, after `logs               MaintenanceLog[]` (around line 876) add:

```prisma
  managedItemId      String?
  managedItem        ManagedItem? @relation(fields: [managedItemId], references: [id], onDelete: SetNull)
```

And after the existing `@@index([buildingId])`:

```prisma
  @@index([managedItemId])
```

- [ ] **Step 3: Add back-relation to `CommonArea`**

Inside `model CommonArea`, after `notes                 String?` (around line 1098) add:

```prisma
  managedItems          ManagedItem[]
```

- [ ] **Step 4: Validate schema**

Run: `npx prisma validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 5: Generate the migration SQL (diff, do NOT migrate dev)**

```bash
TS=$(date +%Y%m%d%H%M%S)
DIR="prisma/migrations/${TS}_managed_item_area_and_task_link"
mkdir -p "$DIR"
npx prisma migrate diff \
  --from-config-datasource prisma.config.ts \
  --to-schema prisma/schema.prisma \
  --script > "$DIR/migration.sql"
cat "$DIR/migration.sql"
```

Expected: additive-only SQL — two `ALTER TABLE ... ADD COLUMN "commonAreaId"/"managedItemId"`, two `CREATE INDEX`, two `ADD CONSTRAINT ... FOREIGN KEY ... ON DELETE SET NULL`. **No `DROP`.** If any `DROP` appears, stop and re-check the schema edits.

- [ ] **Step 6: Apply the migration + regenerate client**

```bash
npx prisma migrate deploy
npx prisma generate
```

Expected: `migrate deploy` reports 1 migration applied; `generate` succeeds.

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors (new fields exist on the generated client).

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(schema): link managed items to common areas and recurring tasks to items"
```

---

## Task 2: RBAC — new `managed-buildings` module + EMPLOYEE access

EMPLOYEE is already a `STAFF_ROLE` (see `lib/building-access.ts`) so `requireBuildingCap(..., "manageManagedItems"|"manageMaintenance")` already passes for it. The only gap is a **navigable surface**. We add one module and grant it to SUPER_ADMIN/ADMIN/MANAGER/EMPLOYEE. `prisma/seed-rbac.ts backfillNewModules()` inserts these defaults for already-seeded roles on deploy (idempotent) — no manual DB edit.

**Files:**
- Modify: `lib/rbac/registry.ts`
- Test: `lib/rbac/registry.managed-buildings.test.ts`

- [ ] **Step 1: Write the failing test** (`lib/rbac/registry.managed-buildings.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import { RBAC_MODULES, DEFAULT_PERMISSIONS } from "./registry";

describe("managed-buildings module", () => {
  it("is registered on the company surface with a menu entry", () => {
    const m = RBAC_MODULES.find((x) => x.key === "managed-buildings");
    expect(m).toBeTruthy();
    expect(m!.surface).toBe("company");
    expect(m!.menu?.href).toBe("/super-admin/managed-buildings");
  });

  it("is granted (view) to the four company roles including EMPLOYEE", () => {
    for (const role of ["SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE"] as const) {
      expect(DEFAULT_PERMISSIONS[role]).toContain("managed-buildings:view");
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/rbac/registry.managed-buildings.test.ts`
Expected: FAIL — module not found / permission missing.

- [ ] **Step 3: Register the module**

In `lib/rbac/registry.ts`, add this line to `RBAC_MODULES` immediately after the `managed-items` module line:

```ts
  { key: "managed-buildings", label: "Διαχειριζόμενα κτήρια", surface: "company", menu: { href: "/super-admin/managed-buildings", icon: "RiBuilding2Line", group: "management" }, actions: [...CRUD] },
```

- [ ] **Step 4: Grant defaults**

In `DEFAULT_PERMISSIONS`, edit the four roles:

- `SUPER_ADMIN: all()` — already covers every module, no change.
- `ADMIN` — append `"managed-buildings"` to its existing `crud(...)` list that ends with `"managed-items"`:

```ts
    ...crud("properties", "units", "users", "residents", "maintenance", "announcements", "calendar", "managed-items", "managed-buildings"),
```

- `MANAGER` — append `"managed-buildings"`:

```ts
    ...crud("properties", "units", "maintenance", "announcements", "managed-items", "managed-buildings"),
```

- `EMPLOYEE` — add managed surfaces. Replace the whole `EMPLOYEE` array with:

```ts
  EMPLOYEE: [
    ...view("mkt-dashboard", "mkt-calendar", "managed-buildings"), ...crud("mkt-tasks", "mkt-maintenance"),
    ...crud("managed-items"), ...view("maintenance", "calendar"),
  ],
```

(`managed-items` CRUD + `maintenance`/`calendar` view let EMPLOYEE assign items, see schedules, and open the calendar via the company surface too.)

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run lib/rbac/registry.managed-buildings.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add lib/rbac/registry.ts lib/rbac/registry.managed-buildings.test.ts
git commit -m "feat(rbac): managed-buildings module + EMPLOYEE access to managed items"
```

---

## Task 3: Loader — common areas + per-item schedule

**Files:**
- Modify: `lib/building/dashboard-data.ts`

- [ ] **Step 1: Load common areas and each item's active schedule**

In `lib/building/dashboard-data.ts`, extend the `Promise.all` at the `[contacts, infraPoints, taskRows, managedItemRows, managedItemTypes]` destructuring (around line 106). Change the destructure to add `commonAreas`:

```ts
  const [contacts, infraPoints, taskRows, managedItemRows, managedItemTypes, commonAreas] = await Promise.all([
```

Update the `db.managedItem.findMany` select to also pull the linked active task:

```ts
    db.managedItem.findMany({
      where: { buildingId: id },
      orderBy: [{ location: "asc" }, { createdAt: "asc" }],
      select: {
        id: true, itemTypeId: true, location: true, floorLabel: true, quantity: true,
        photoUrl: true, notes: true, commonAreaId: true,
        itemType: { select: { name: true } },
        tasks: {
          where: { active: true },
          orderBy: { nextDueDate: "asc" },
          take: 1,
          select: { id: true, title: true, frequency: true, nextDueDate: true, vendor: true, reminderDaysBefore: true, active: true },
        },
      },
    }),
```

Then append a new query to the same `Promise.all` array (after the `managedItemType.findMany(...)` entry):

```ts
    db.commonArea.findMany({ where: { buildingId: id }, orderBy: [{ floor: "asc" }, { name: "asc" }], select: { id: true, name: true, floor: true } }),
```

- [ ] **Step 2: Map the schedule + commonAreaId into the returned `managedItems`**

Replace the `managedItems: managedItemRows.map(...)` block (around line 303) with:

```ts
    managedItems: managedItemRows.map((m) => ({
      id: m.id, itemTypeId: m.itemTypeId, itemTypeName: m.itemType.name,
      location: m.location, floorLabel: m.floorLabel, quantity: m.quantity,
      photoUrl: m.photoUrl, notes: m.notes,
      commonAreaId: m.commonAreaId,
      schedule: m.tasks[0]
        ? {
            id: m.tasks[0].id, title: m.tasks[0].title, frequency: m.tasks[0].frequency,
            nextDueDate: m.tasks[0].nextDueDate ? m.tasks[0].nextDueDate.toISOString() : null,
            vendor: m.tasks[0].vendor, reminderDaysBefore: m.tasks[0].reminderDaysBefore, active: m.tasks[0].active,
          }
        : null,
    })),
```

- [ ] **Step 3: Return the common areas**

Add `commonAreas,` to the returned object next to `managedItemTypes,` (around line 308):

```ts
    managedItemTypes,
    commonAreas,
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add lib/building/dashboard-data.ts
git commit -m "feat(loader): supply common areas and per-item maintenance schedule to building dashboard"
```

---

## Task 4: `managed-items.ts` action — common-area targeting

**Files:**
- Modify: `app/actions/managed-items.ts`

- [ ] **Step 1: Extend the input type + validation helper**

In `app/actions/managed-items.ts`, replace the `ManagedItemInput` type and add a pure area validator:

```ts
export type ManagedItemInput = { itemTypeId: string; location: string; floorLabel?: string | null; quantity?: number | null; notes?: string | null; commonAreaId?: string | null };
```

Add a helper that confirms a chosen area belongs to the building (place it under `validate`):

```ts
async function resolveCommonArea(buildingId: string, commonAreaId?: string | null): Promise<{ ok: true; id: string | null } | { error: string }> {
  const id = commonAreaId?.trim() || null;
  if (!id) return { ok: true, id: null };
  const area = await db.commonArea.findFirst({ where: { id, buildingId }, select: { id: true } });
  if (!area) return { error: "Ο κοινόχρηστος χώρος δεν ανήκει σε αυτό το κτήριο" };
  return { ok: true, id: area.id };
}
```

- [ ] **Step 2: Persist `commonAreaId` on create**

In `createManagedItem`, after `if (!type) return { error: "Το στοιχείο δεν βρέθηκε στον κατάλογο" };` add:

```ts
  const area = await resolveCommonArea(buildingId, data.commonAreaId);
  if ("error" in area) return { error: area.error };
```

And add `commonAreaId: area.id,` to the `db.managedItem.create({ data: { ... } })` payload.

- [ ] **Step 3: Persist `commonAreaId` on update**

In `updateManagedItem`, after `if (err) return { error: err };` add:

```ts
  const area = await resolveCommonArea(existing.buildingId, data.commonAreaId);
  if ("error" in area) return { error: area.error };
```

And add `commonAreaId: area.id,` to the `db.managedItem.update({ ... data: { ... } })` payload.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/actions/managed-items.ts
git commit -m "feat(actions): managed items can target a validated common area"
```

---

## Task 5: `recurring-tasks.ts` action — link a schedule to an item

**Files:**
- Modify: `app/actions/recurring-tasks.ts`

- [ ] **Step 1: Extend `TaskInput` + add a same-building validator**

In `app/actions/recurring-tasks.ts`, add `managedItemId` to `TaskInput`:

```ts
export type TaskInput = { title: string; frequency: TaskFrequency; nextDueDate?: string | null; vendor?: string | null; notes?: string | null; active?: boolean; kind?: MaintenanceKind; inServicePackage?: boolean; reminderDaysBefore?: number; managedItemId?: string | null };
```

Add below the `clean` helper:

```ts
async function resolveManagedItem(buildingId: string, managedItemId?: string | null): Promise<{ ok: true; id: string | null } | { error: string }> {
  const id = managedItemId?.trim() || null;
  if (!id) return { ok: true, id: null };
  const item = await db.managedItem.findFirst({ where: { id, buildingId }, select: { id: true } });
  if (!item) return { error: "Το στοιχείο δεν ανήκει σε αυτό το κτήριο" };
  return { ok: true, id: item.id };
}
```

- [ ] **Step 2: Persist on create**

In `createRecurringTask`, after the freq resolution line `const freq = ...` add:

```ts
  const mi = await resolveManagedItem(buildingId, data.managedItemId);
  if ("error" in mi) return { error: mi.error };
```

Add `managedItemId: mi.id,` to the `db.recurringTask.create({ data: { ... } })` payload.

- [ ] **Step 3: Persist on update**

In `updateRecurringTask`, after `await requireBuildingCap(existing.buildingId, "manageCalendar");` add:

```ts
  let managedItemId: string | null | undefined;
  if (data.managedItemId !== undefined) {
    const mi = await resolveManagedItem(existing.buildingId, data.managedItemId);
    if ("error" in mi) return { error: mi.error };
    managedItemId = mi.id;
  }
```

Add to the `db.recurringTask.update({ ... data: { ... } })` payload (alongside the other conditional spreads):

```ts
      ...(managedItemId !== undefined ? { managedItemId } : {}),
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/actions/recurring-tasks.ts
git commit -m "feat(actions): recurring task can attach to a managed item"
```

---

## Task 6: `ManagedItemsPanel` — common-area select + inline schedule

The item modal gains a **Κοινόχρηστος χώρος** select (auto-fills `location` label when empty) and a **Συντήρηση** section that creates/edits one linked `RecurringTask`. The panel receives `commonAreas` and each item's `commonAreaId`/`schedule` (from Task 3).

**Files:**
- Modify: `components/building/ManagedItemsPanel.tsx`

- [ ] **Step 1: Extend row types + panel props + imports**

At the top of `components/building/ManagedItemsPanel.tsx`, extend the imports to add the task action + icons:

```ts
import { createRecurringTask, updateRecurringTask, type TaskFrequency } from "@/app/actions/recurring-tasks";
```

Add `RiCalendarLine, RiRepeatLine` to the existing `react-icons/ri` import list.

Replace the `ManagedItemRow` type and add supporting types:

```ts
export type ManagedItemSchedule = { id: string; title: string; frequency: TaskFrequency; nextDueDate: string | null; vendor: string | null; reminderDaysBefore: number; active: boolean };
export type ManagedItemRow = {
  id: string; itemTypeId: string; itemTypeName: string;
  location: string; floorLabel: string | null;
  quantity: number; photoUrl: string | null; notes: string | null;
  commonAreaId: string | null; schedule: ManagedItemSchedule | null;
};
export type ManagedItemTypeOption = { id: string; name: string; active: boolean };
export type CommonAreaOption = { id: string; name: string; floor: number | null };
```

Change the panel signature to accept `commonAreas`:

```ts
export function ManagedItemsPanel({ buildingId, items, itemTypes, floorOptions, commonAreas, can }: { buildingId: string; items: ManagedItemRow[]; itemTypes: ManagedItemTypeOption[]; floorOptions: string[]; commonAreas: CommonAreaOption[]; can: BuildingCaps }) {
```

Pass `commonAreas` down to the modal — in the `<ManagedItemModal ... />` render add the prop:

```tsx
        <ManagedItemModal
          buildingId={buildingId}
          itemTypes={itemTypes}
          floorOptions={floorOptions}
          commonAreas={commonAreas}
          editing={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onDone={() => { setEditing(null); router.refresh(); }}
        />
```

- [ ] **Step 2: Show the schedule in the table**

In the items `<table>`, add a header cell after `<th style={th}>Τοποθεσία</th>`:

```tsx
              <th style={th}>Συντήρηση</th>
```

And a matching body cell after the location `<td>` (the one rendering `i.location`):

```tsx
                  <td style={td}>
                    {i.schedule ? (
                      <span style={{ ...chip, background: "var(--color-green-soft, #E4F0EA)", color: "var(--color-green, #22604A)" }}>
                        <RiRepeatLine style={{ fontSize: 12 }} /> {FREQ_LABEL[i.schedule.frequency]}
                        {i.schedule.nextDueDate ? ` · ${new Date(i.schedule.nextDueDate).toLocaleDateString("el-GR")}` : ""}
                      </span>
                    ) : <span style={{ color: "var(--muted-foreground)" }}>—</span>}
                  </td>
```

Add the frequency-label map near `LOCATION_SUGGESTIONS` at module top:

```ts
const FREQ_LABEL: Record<TaskFrequency, string> = { WEEKLY: "Εβδομαδιαία", MONTHLY: "Μηνιαία", QUARTERLY: "Τριμηνιαία", SEMIANNUAL: "Εξαμηνιαία", ANNUAL: "Ετήσια", CUSTOM: "Προσαρμοσμένη" };
const FREQ_OPTIONS: { value: TaskFrequency; label: string }[] = (Object.keys(FREQ_LABEL) as TaskFrequency[]).map((f) => ({ value: f, label: FREQ_LABEL[f] }));
```

- [ ] **Step 3: Add common-area + schedule state to the modal**

In `ManagedItemModal`, change the signature to accept `commonAreas`:

```ts
function ManagedItemModal({ buildingId, itemTypes, floorOptions, commonAreas, editing, onClose, onDone }: { buildingId: string; itemTypes: ManagedItemTypeOption[]; floorOptions: string[]; commonAreas: CommonAreaOption[]; editing: ManagedItemRow | null; onClose: () => void; onDone: () => void }) {
```

Extend the `form` state initializer to include `commonAreaId` and add schedule state:

```ts
  const [form, setForm] = useState({
    itemTypeId: editing?.itemTypeId ?? "",
    location: editing?.location ?? "",
    floorLabel: editing?.floorLabel ?? "",
    quantity: editing?.quantity ?? 1,
    notes: editing?.notes ?? "",
    commonAreaId: editing?.commonAreaId ?? "",
  });
  const [sched, setSched] = useState({
    enabled: !!editing?.schedule,
    frequency: (editing?.schedule?.frequency ?? "MONTHLY") as TaskFrequency,
    nextDueDate: editing?.schedule?.nextDueDate ? editing.schedule.nextDueDate.slice(0, 10) : "",
    vendor: editing?.schedule?.vendor ?? "",
  });
```

- [ ] **Step 4: Persist the common area + schedule in `save()`**

Replace the `save()` body in `ManagedItemModal` with:

```ts
  function save() {
    setError(null);
    const payload = { itemTypeId: form.itemTypeId, location: form.location, floorLabel: form.floorLabel || null, quantity: form.quantity, notes: form.notes, commonAreaId: form.commonAreaId || null };
    startTransition(async () => {
      const res = editing ? await updateManagedItem(editing.id, payload) : await createManagedItem(buildingId, payload);
      if (res && "error" in res && res.error) { setError(res.error); return; }
      const itemId = (res as { itemId?: string }).itemId;
      if (itemId && photoRemoved && editing?.photoUrl && !photoFile) {
        await deleteManagedItemPhoto(itemId);
      }
      if (itemId && photoFile) {
        const fd = new FormData();
        fd.set("itemId", itemId);
        fd.set("file", photoFile);
        const up = await uploadManagedItemPhoto(fd);
        if (up && "error" in up && up.error) { setError(`Το στοιχείο αποθηκεύτηκε, αλλά η φωτογραφία απέτυχε: ${up.error}`); return; }
      }
      // Maintenance schedule (one linked RecurringTask)
      if (itemId && sched.enabled) {
        const taskPayload = {
          title: itemTypes.find((t) => t.id === form.itemTypeId)?.name ?? "Συντήρηση",
          frequency: sched.frequency,
          nextDueDate: sched.nextDueDate || null,
          vendor: sched.vendor || null,
          managedItemId: itemId,
          active: true,
        };
        const sres = editing?.schedule
          ? await updateRecurringTask(editing.schedule.id, taskPayload)
          : await createRecurringTask(buildingId, taskPayload);
        if (sres && "error" in sres && sres.error) { setError(`Το στοιχείο αποθηκεύτηκε, αλλά το πρόγραμμα συντήρησης απέτυχε: ${sres.error}`); return; }
      } else if (itemId && !sched.enabled && editing?.schedule) {
        await updateRecurringTask(editing.schedule.id, { active: false });
      }
      onDone();
    });
  }
```

- [ ] **Step 5: Add the UI controls to the modal body**

In the modal body, immediately after the `Τοποθεσία`/`Όροφος` grid `</div>`, insert the common-area select:

```tsx
        {commonAreas.length > 0 && (
          <FormField label="Κοινόχρηστος χώρος" hint="Προαιρετικό — σύνδεση με συγκεκριμένο χώρο του κτηρίου">
            <FieldSelect
              value={form.commonAreaId}
              onChange={(v) => setForm((p) => ({ ...p, commonAreaId: v, location: p.location.trim() ? p.location : (commonAreas.find((a) => a.id === v)?.name ?? p.location) }))}
              placeholder="— Χωρίς σύνδεση —"
              options={commonAreas.map((a) => ({ value: a.id, label: a.floor != null ? `${a.name} (όροφος ${a.floor})` : a.name }))}
            />
          </FormField>
        )}
```

Then, after the `Σημειώσεις` `FormField`, add the schedule section:

```tsx
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, marginTop: 2 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: "var(--foreground)", cursor: "pointer" }}>
            <input type="checkbox" checked={sched.enabled} onChange={(e) => setSched((p) => ({ ...p, enabled: e.target.checked }))} />
            <RiCalendarLine style={{ color: "var(--muted-foreground)" }} /> Πρόγραμμα συντήρησης
          </label>
          {sched.enabled && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
              <FormField label="Συχνότητα" required>
                <FieldSelect value={sched.frequency} onChange={(v) => setSched((p) => ({ ...p, frequency: v as TaskFrequency }))} options={FREQ_OPTIONS} />
              </FormField>
              <FormField label="Επόμενη ημερομηνία">
                <input type="date" value={sched.nextDueDate} onChange={(e) => setSched((p) => ({ ...p, nextDueDate: e.target.value }))} style={inputStyle} />
              </FormField>
              <div style={{ gridColumn: "1 / -1" }}>
                <FormField label="Συνεργείο / πάροχος" hint="Προαιρετικό">
                  <input value={sched.vendor} onChange={(e) => setSched((p) => ({ ...p, vendor: e.target.value }))} placeholder="π.χ. Καθαριότητα ΑΕ" style={inputStyle} />
                </FormField>
              </div>
            </div>
          )}
        </div>
```

- [ ] **Step 6: Update every caller to pass `commonAreas`**

The panel is rendered from the manager shell and the super-admin building dashboard. Find the render sites:

Run: `grep -rn "ManagedItemsPanel" components app --include="*.tsx"`

At each `<ManagedItemsPanel ... />` usage, add `commonAreas={data.commonAreas}` (use whatever the local variable holding the loader result is — it exposes `commonAreas` from Task 3). Confirm both the manager shell (`components/building/manager-shell/`) and `app/(company)/super-admin/buildings/[id]/…` pass it.

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. If a caller error appears, it means a render site still lacks `commonAreas` — fix per Step 6.

- [ ] **Step 8: Manual smoke**

Run: `npm run dev`, open a managed building's «Διαχειριζόμενα στοιχεία» tab, add an item, pick a common area, enable «Πρόγραμμα συντήρησης» = Εβδομαδιαία with a next date. Save. Reopen: the area + schedule persist; the table shows the frequency chip.

- [ ] **Step 9: Commit**

```bash
git add components/building/ManagedItemsPanel.tsx components/building/manager-shell app/\(company\)/super-admin/buildings
git commit -m "feat(ui): managed item editor gains common-area link and inline maintenance schedule"
```

---

## Task 7: Maintenance calendar feed (pure projection + query)

**Files:**
- Create: `lib/dashboard/maintenance-calendar.ts`
- Test: `lib/dashboard/maintenance-calendar.test.ts`

- [ ] **Step 1: Write the failing test** (`lib/dashboard/maintenance-calendar.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import { expandOccurrences } from "./maintenance-calendar";

const from = new Date("2026-07-01T00:00:00Z");
const to = new Date("2026-07-31T23:59:59Z");

describe("expandOccurrences", () => {
  it("projects a weekly task across the window", () => {
    const out = expandOccurrences(new Date("2026-07-06T00:00:00Z"), "WEEKLY", from, to);
    expect(out.map((d) => d.toISOString().slice(0, 10))).toEqual(["2026-07-06", "2026-07-13", "2026-07-20", "2026-07-27"]);
  });

  it("emits a single occurrence for CUSTOM frequency", () => {
    const out = expandOccurrences(new Date("2026-07-10T00:00:00Z"), "CUSTOM", from, to);
    expect(out).toHaveLength(1);
  });

  it("includes an overdue occurrence before the window start (clamped to one)", () => {
    const out = expandOccurrences(new Date("2026-06-05T00:00:00Z"), "MONTHLY", from, to);
    // 2026-06-05 (overdue) then 07-05 within window
    expect(out.map((d) => d.toISOString().slice(0, 10))).toEqual(["2026-06-05", "2026-07-05"]);
  });

  it("returns empty when there is no due date", () => {
    expect(expandOccurrences(null, "WEEKLY", from, to)).toEqual([]);
  });

  it("caps runaway projections at 500 occurrences", () => {
    const out = expandOccurrences(new Date("2020-01-01T00:00:00Z"), "WEEKLY", from, new Date("2100-01-01T00:00:00Z"));
    expect(out.length).toBeLessThanOrEqual(500);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/dashboard/maintenance-calendar.test.ts`
Expected: FAIL — `expandOccurrences` not defined.

- [ ] **Step 3: Implement the projection + feed** (`lib/dashboard/maintenance-calendar.ts`)

```ts
import "server-only";
import { db } from "@/lib/db";

export type TaskFrequency = "WEEKLY" | "MONTHLY" | "QUARTERLY" | "SEMIANNUAL" | "ANNUAL" | "CUSTOM";

export type MaintenanceCalEvent = {
  id: string;            // synthetic: `${taskId}@${isoDate}`
  taskId: string;
  buildingId: string;
  buildingName: string;
  title: string;
  kind: string;
  itemName: string | null;
  date: string;          // ISO
  overdue: boolean;
};

const MAX_OCCURRENCES = 500;

function step(date: Date, freq: TaskFrequency): Date {
  const d = new Date(date);
  switch (freq) {
    case "WEEKLY": d.setDate(d.getDate() + 7); break;
    case "MONTHLY": d.setMonth(d.getMonth() + 1); break;
    case "QUARTERLY": d.setMonth(d.getMonth() + 3); break;
    case "SEMIANNUAL": d.setMonth(d.getMonth() + 6); break;
    case "ANNUAL": d.setFullYear(d.getFullYear() + 1); break;
    case "CUSTOM": break;
  }
  return d;
}

/**
 * Project a recurring task's occurrences that fall within [from, to].
 * If `nextDueDate` is before `from`, include exactly that one overdue occurrence,
 * then step forward into the window. CUSTOM = the single date only.
 */
export function expandOccurrences(nextDueDate: Date | null, freq: TaskFrequency, from: Date, to: Date): Date[] {
  if (!nextDueDate) return [];
  const out: Date[] = [];
  if (freq === "CUSTOM") {
    if (nextDueDate <= to) out.push(new Date(nextDueDate));
    return out;
  }
  // Include one overdue occurrence (the current nextDueDate) if it precedes the window.
  let cursor = new Date(nextDueDate);
  if (cursor < from) {
    out.push(new Date(cursor));
    // advance until we reach/enter the window
    while (cursor < from && out.length < MAX_OCCURRENCES) cursor = step(cursor, freq);
  }
  while (cursor <= to && out.length < MAX_OCCURRENCES) {
    out.push(new Date(cursor));
    cursor = step(cursor, freq);
  }
  return out;
}

/** All maintenance occurrences across managed buildings within [from, to]. */
export async function listMaintenanceCalendar(from: Date, to: Date): Promise<MaintenanceCalEvent[]> {
  const tasks = await db.recurringTask.findMany({
    where: { active: true, nextDueDate: { not: null }, building: { property: { managed: true } } },
    select: {
      id: true, title: true, frequency: true, nextDueDate: true, kind: true, buildingId: true,
      building: { select: { name: true } },
      managedItem: { select: { itemType: { select: { name: true } } } },
    },
  });
  const now = new Date();
  const events: MaintenanceCalEvent[] = [];
  for (const t of tasks) {
    const dates = expandOccurrences(t.nextDueDate, t.frequency as TaskFrequency, from, to);
    for (const d of dates) {
      const iso = d.toISOString();
      events.push({
        id: `${t.id}@${iso}`,
        taskId: t.id,
        buildingId: t.buildingId,
        buildingName: t.building.name,
        title: t.title,
        kind: t.kind,
        itemName: t.managedItem?.itemType.name ?? null,
        date: iso,
        overdue: d < now,
      });
    }
  }
  return events;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/dashboard/maintenance-calendar.test.ts`
Expected: PASS (all 5 cases).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add lib/dashboard/maintenance-calendar.ts lib/dashboard/maintenance-calendar.test.ts
git commit -m "feat(calendar): project recurring maintenance occurrences across managed buildings"
```

---

## Task 8: Staff calendar — render maintenance events

Merge maintenance occurrences into the existing calendar as a second, colour-coded event type with a filter. The page maps each `MaintenanceCalEvent` into the existing `DemoEvent`-shaped stream (with a `kind` discriminator) so day-cell layout is reused; only chip colour, the detail modal, and a filter branch on `kind`.

**Files:**
- Modify: `app/(company)/staff/calendar/page.tsx`
- Modify: `app/(company)/staff/calendar/DemoCalendarClient.tsx`

- [ ] **Step 1: Load + merge maintenance events in the page**

In `app/(company)/staff/calendar/page.tsx`, add the import:

```ts
import { listMaintenanceCalendar } from "@/lib/dashboard/maintenance-calendar";
```

After `const rows = await listDemoRequests(from, to);` add:

```ts
  const maint = await listMaintenanceCalendar(from, to);
```

Change the `events` prop mapping passed to `<DemoCalendarClient>` to concatenate maintenance, mapped into the shared shape:

```tsx
      events={[
        ...rows.map((r) => ({
          id: r.id, kind: "demo" as const, name: r.name, email: r.email, phone: r.phone,
          company: r.company, message: r.message, status: r.status,
          scheduledAt: r.scheduledAt.toISOString(), durationMin: r.durationMin,
          buildingId: null as string | null, buildingName: null as string | null, overdue: false, itemName: null as string | null,
        })),
        ...maint.map((m) => ({
          id: m.id, kind: "maintenance" as const, name: m.title, email: "", phone: null,
          company: m.buildingName, message: m.itemName, status: m.overdue ? "OVERDUE" : "SCHEDULED",
          scheduledAt: m.date, durationMin: 0,
          buildingId: m.buildingId, buildingName: m.buildingName, overdue: m.overdue, itemName: m.itemName,
        })),
      ]}
```

- [ ] **Step 2: Extend the event type + add maintenance colours**

In `app/(company)/staff/calendar/DemoCalendarClient.tsx`, extend `DemoEvent`:

```ts
export type DemoEvent = {
  id: string; name: string; email: string; phone: string | null; company: string | null;
  message: string | null; status: string; scheduledAt: string; durationMin: number;
  kind?: "demo" | "maintenance"; buildingId?: string | null; buildingName?: string | null;
  overdue?: boolean; itemName?: string | null;
};
```

Add two maintenance statuses to the `STATUS` map:

```ts
  SCHEDULED: { label: "Προγραμματισμένη", bg: "#E4F0EA", fg: "#22604A", bar: "#2E7D5B" },
  OVERDUE: { label: "Εκπρόθεσμη", bg: "#FBE4E4", fg: "#9A2B2B", bar: "#C0392B" },
```

- [ ] **Step 3: Add a kind filter**

Right after `const [dayFocus, setDayFocus] = useState<Date | null>(null);` add:

```ts
  const [kindFilter, setKindFilter] = useState<"all" | "demo" | "maintenance">("all");
  const events = useMemo(() => allEvents.filter((e) => kindFilter === "all" || (e.kind ?? "demo") === kindFilter), [allEvents, kindFilter]);
```

Rename the incoming prop to `allEvents` in the component signature:

```ts
export function DemoCalendarClient({ events: allEvents, today }: { events: DemoEvent[]; today: string }) {
```

(Every existing reference to `events` inside the component now reads the filtered memo.)

Add the filter UI near the month header — insert before the month navigation buttons block (search for the `<h1 ...>Ημερολόγιο ραντεβού</h1>` heading and place this right after its containing header `</div>` closes the title group). Use this control:

```tsx
        <div role="tablist" aria-label="Φίλτρο τύπου" style={{ display: "inline-flex", gap: 4, background: "var(--paper, #FBFAF5)", border: "1px solid var(--border)", borderRadius: 999, padding: 3 }}>
          {([["all", "Όλα"], ["demo", "Ραντεβού"], ["maintenance", "Συντηρήσεις"]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setKindFilter(k)} className="dcal-btn"
              style={{ border: "none", borderRadius: 999, padding: "5px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer",
                background: kindFilter === k ? "var(--foreground)" : "transparent", color: kindFilter === k ? "#fff" : "var(--muted-foreground)" }}>
              {label}
            </button>
          ))}
        </div>
```

- [ ] **Step 4: Colour maintenance chips distinctly**

The day-cell chip and the `title` attribute currently key off `STATUS[e.status]`. Since maintenance events use `SCHEDULED`/`OVERDUE` (added to `STATUS` in Step 2), they already resolve to green/red. Add a kind-aware leading marker so the type is legible at a glance: in the day-cell chip (the `<button ...>` that renders `timeFmt.format(...)` + name), replace the leading time `<span>` (the one with `fontVariantNumeric: "tabular-nums", flex: "none"`) with an icon-or-time marker (maintenance events have no meaningful time, so show a tools icon):

```tsx
                          <span style={{ display: "inline-flex", alignItems: "center", flex: "none" }}>
                            {e.kind === "maintenance"
                              ? <RiToolsLine style={{ fontSize: 12 }} aria-hidden />
                              : <span style={{ fontVariantNumeric: "tabular-nums" }}>{timeFmt.format(new Date(e.scheduledAt))}</span>}
                          </span>
```

Add `RiToolsLine` to the `react-icons/ri` import at the top of the file.

- [ ] **Step 5: Branch the detail modal for maintenance**

Locate the JSX that renders the demo detail modal — it begins with `{selected && (`. Replace that opening with a maintenance branch:

```tsx
      {selected && selected.kind === "maintenance" ? (
        <MaintenanceEventModal event={selected} onClose={() => setSelected(null)} />
      ) : selected && (
```

Add the `MaintenanceEventModal` component at the bottom of the file (before the trailing style/consts):

```tsx
function MaintenanceEventModal({ event, onClose }: { event: DemoEvent; onClose: () => void }) {
  const d = new Date(event.scheduledAt);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(27,28,26,.34)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 60 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(440px, 96vw)", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 38, height: 38, borderRadius: 10, background: event.overdue ? "#FBE4E4" : "#E4F0EA", color: event.overdue ? "#9A2B2B" : "#22604A" }}>
            <RiToolsLine />
          </span>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "var(--foreground)" }}>{event.name}</div>
            <div style={{ fontSize: 12.5, color: "var(--muted-foreground)" }}>{longFmt.format(d)}</div>
          </div>
          <button onClick={onClose} aria-label="Κλείσιμο" style={{ marginLeft: "auto", border: "none", background: "transparent", cursor: "pointer", color: "var(--muted-foreground)" }}><RiCloseLine style={{ fontSize: 20 }} /></button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13.5, color: "var(--foreground)" }}>
          {event.buildingName && <div style={{ display: "flex", alignItems: "center", gap: 8 }}><RiBuilding2Line style={{ color: "var(--muted-foreground)" }} /> {event.buildingName}</div>}
          {event.itemName && <div style={{ display: "flex", alignItems: "center", gap: 8 }}><RiToolsLine style={{ color: "var(--muted-foreground)" }} /> {event.itemName}</div>}
          <div><StatusPill status={event.status} /></div>
        </div>
        {event.buildingId && (
          <a href={`/super-admin/buildings/${event.buildingId}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 14, fontSize: 13, fontWeight: 700, color: "var(--color-primary)", textDecoration: "none" }}>
            Άνοιγμα κτηρίου <RiArrowRightSLine />
          </a>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Manual smoke**

Run: `npm run dev`, open `/staff/calendar`. Maintenance schedules from Task 6 appear as green (or red if overdue) chips with a tools icon; the «Συντηρήσεις» filter shows only those; clicking one opens the maintenance modal with a link to the building. Demo bookings still render and filter under «Ραντεβού».

- [ ] **Step 8: Commit**

```bash
git add app/\(company\)/staff/calendar
git commit -m "feat(calendar): show maintenance schedules alongside demo bookings with a type filter"
```

---

## Task 9: Managed-buildings data layer (aggregation + classifier)

**Files:**
- Create: `lib/dashboard/managed-buildings.ts`
- Test: `lib/dashboard/managed-buildings.test.ts`

- [ ] **Step 1: Write the failing test** (`lib/dashboard/managed-buildings.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import { classifyObligation } from "./managed-buildings";

const now = new Date("2026-07-21T00:00:00Z");

describe("classifyObligation", () => {
  it("flags a past due date as overdue", () => {
    expect(classifyObligation("2026-07-10T00:00:00Z", 7, now)).toBe("overdue");
  });
  it("flags within-reminder-window as due-soon", () => {
    expect(classifyObligation("2026-07-25T00:00:00Z", 7, now)).toBe("due-soon");
  });
  it("flags far future as scheduled", () => {
    expect(classifyObligation("2026-09-01T00:00:00Z", 7, now)).toBe("scheduled");
  });
  it("treats a null due date as none", () => {
    expect(classifyObligation(null, 7, now)).toBe("none");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/dashboard/managed-buildings.test.ts`
Expected: FAIL — `classifyObligation` not defined.

- [ ] **Step 3: Implement the data layer** (`lib/dashboard/managed-buildings.ts`)

```ts
import "server-only";
import { db } from "@/lib/db";
import { listMaintenanceHistory } from "@/app/actions/maintenance-logs";

export type ObligationStatus = "overdue" | "due-soon" | "scheduled" | "none";

export function classifyObligation(nextDueIso: string | null, reminderDaysBefore: number, now: Date): ObligationStatus {
  if (!nextDueIso) return "none";
  const due = new Date(nextDueIso);
  if (due < now) return "overdue";
  const windowMs = Math.max(1, reminderDaysBefore) * 24 * 3600 * 1000;
  if (due.getTime() - now.getTime() <= windowMs) return "due-soon";
  return "scheduled";
}

export type ManagedBuildingRow = {
  id: string; name: string; address: string | null; customerName: string;
  itemCount: number; totalQuantity: number; scheduleCount: number;
  nextDueDate: string | null; overdueCount: number;
};

export async function listManagedBuildings(): Promise<ManagedBuildingRow[]> {
  const buildings = await db.building.findMany({
    where: { property: { managed: true } },
    orderBy: { name: "asc" },
    select: {
      id: true, name: true, address: true,
      property: { select: { customer: { select: { name: true } } } },
      managedItems: { select: { quantity: true } },
      recurringTasks: { where: { active: true }, select: { nextDueDate: true, reminderDaysBefore: true } },
    },
  });
  const now = new Date();
  return buildings.map((b) => {
    const dues = b.recurringTasks.map((t) => t.nextDueDate).filter((d): d is Date => !!d).sort((x, y) => x.getTime() - y.getTime());
    const overdueCount = b.recurringTasks.filter((t) => classifyObligation(t.nextDueDate?.toISOString() ?? null, t.reminderDaysBefore, now) === "overdue").length;
    return {
      id: b.id, name: b.name, address: b.address,
      customerName: b.property.customer.name,
      itemCount: b.managedItems.length,
      totalQuantity: b.managedItems.reduce((s, m) => s + m.quantity, 0),
      scheduleCount: b.recurringTasks.length,
      nextDueDate: dues[0]?.toISOString() ?? null,
      overdueCount,
    };
  });
}

export type ObligationRow = {
  taskId: string; buildingId: string; buildingName: string; title: string;
  itemName: string | null; nextDueDate: string | null; frequency: string;
  status: ObligationStatus;
};

export async function listUpcomingObligations(): Promise<ObligationRow[]> {
  const tasks = await db.recurringTask.findMany({
    where: { active: true, nextDueDate: { not: null }, building: { property: { managed: true } } },
    orderBy: { nextDueDate: "asc" },
    select: {
      id: true, title: true, frequency: true, nextDueDate: true, reminderDaysBefore: true, buildingId: true,
      building: { select: { name: true } },
      managedItem: { select: { itemType: { select: { name: true } } } },
    },
  });
  const now = new Date();
  return tasks.map((t) => ({
    taskId: t.id, buildingId: t.buildingId, buildingName: t.building.name, title: t.title,
    itemName: t.managedItem?.itemType.name ?? null,
    nextDueDate: t.nextDueDate?.toISOString() ?? null,
    frequency: t.frequency,
    status: classifyObligation(t.nextDueDate?.toISOString() ?? null, t.reminderDaysBefore, now),
  }));
}

export type RecentLogRow = {
  id: string; buildingId: string; buildingName: string; title: string;
  performedAt: string; performedBy: string | null; cost: string | null;
};

export async function listRecentMaintenance(limit = 25): Promise<RecentLogRow[]> {
  const rows = await db.maintenanceLog.findMany({
    where: { building: { property: { managed: true } } },
    orderBy: { performedAt: "desc" },
    take: limit,
    select: {
      id: true, performedAt: true, cost: true, buildingId: true,
      building: { select: { name: true } },
      recurringTask: { select: { title: true } },
      performedBy: { select: { name: true, email: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id, buildingId: r.buildingId, buildingName: r.building.name,
    title: r.recurringTask?.title ?? "—",
    performedAt: r.performedAt.toISOString(),
    performedBy: r.performedBy?.name ?? r.performedBy?.email ?? null,
    cost: r.cost ? r.cost.toString() : null,
  }));
}

export type BuildingDrilldown = {
  items: { id: string; name: string; location: string; quantity: number; scheduleLabel: string | null; nextDueDate: string | null }[];
  history: Awaited<ReturnType<typeof listMaintenanceHistory>>;
};

const FREQ_LABEL: Record<string, string> = { WEEKLY: "Εβδομαδιαία", MONTHLY: "Μηνιαία", QUARTERLY: "Τριμηνιαία", SEMIANNUAL: "Εξαμηνιαία", ANNUAL: "Ετήσια", CUSTOM: "Προσαρμοσμένη" };

export async function getBuildingDrilldown(buildingId: string): Promise<BuildingDrilldown> {
  const items = await db.managedItem.findMany({
    where: { buildingId },
    orderBy: [{ location: "asc" }, { createdAt: "asc" }],
    select: {
      id: true, location: true, quantity: true,
      itemType: { select: { name: true } },
      tasks: { where: { active: true }, orderBy: { nextDueDate: "asc" }, take: 1, select: { frequency: true, nextDueDate: true } },
    },
  });
  const history = await listMaintenanceHistory(buildingId);
  return {
    items: items.map((m) => ({
      id: m.id, name: m.itemType.name, location: m.location, quantity: m.quantity,
      scheduleLabel: m.tasks[0] ? (FREQ_LABEL[m.tasks[0].frequency] ?? m.tasks[0].frequency) : null,
      nextDueDate: m.tasks[0]?.nextDueDate?.toISOString() ?? null,
    })),
    history,
  };
}
```

Note: `listMaintenanceHistory` calls `requireBuildingView` — safe here because the page (Task 10) already gates on `managed-buildings` view and staff pass building view for any managed building.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/dashboard/managed-buildings.test.ts`
Expected: PASS (all 4 cases).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add lib/dashboard/managed-buildings.ts lib/dashboard/managed-buildings.test.ts
git commit -m "feat(obligations): aggregation layer for managed buildings and obligations"
```

---

## Task 10: Managed-buildings page + client

**Files:**
- Create: `app/(company)/super-admin/managed-buildings/page.tsx`
- Create: `app/(company)/super-admin/managed-buildings/ManagedBuildingsClient.tsx`

- [ ] **Step 1: Server page** (`app/(company)/super-admin/managed-buildings/page.tsx`)

```tsx
import { requirePermission } from "@/lib/rbac/permissions";
import { listManagedBuildings, listUpcomingObligations, listRecentMaintenance } from "@/lib/dashboard/managed-buildings";
import { ManagedBuildingsClient } from "./ManagedBuildingsClient";

export const metadata = { title: "Διαχειριζόμενα κτήρια" };
export const dynamic = "force-dynamic";

export default async function ManagedBuildingsPage() {
  await requirePermission("managed-buildings", "view");
  const [buildings, obligations, recent] = await Promise.all([
    listManagedBuildings(),
    listUpcomingObligations(),
    listRecentMaintenance(),
  ]);
  return <ManagedBuildingsClient buildings={buildings} obligations={obligations} recent={recent} />;
}
```

- [ ] **Step 2: Client** (`app/(company)/super-admin/managed-buildings/ManagedBuildingsClient.tsx`)

```tsx
"use client";

import { useMemo } from "react";
import Link from "next/link";
import { DataTable, type ColDef } from "@/components/ui/data-table";
import {
  RiBuilding2Line, RiToolsLine, RiStackLine, RiAlarmWarningLine, RiCalendarCheckLine, RiExternalLinkLine,
} from "react-icons/ri";
import type { ManagedBuildingRow, ObligationRow, RecentLogRow, ObligationStatus } from "@/lib/dashboard/managed-buildings";

const STATUS_STYLE: Record<ObligationStatus, { label: string; bg: string; fg: string }> = {
  overdue: { label: "Εκπρόθεσμη", bg: "#FBE4E4", fg: "#9A2B2B" },
  "due-soon": { label: "Επικείμενη", bg: "#FDF1DF", fg: "#9A5B00" },
  scheduled: { label: "Προγραμματισμένη", bg: "#E4F0EA", fg: "#22604A" },
  none: { label: "—", bg: "#F0F0EE", fg: "#8a8a85" },
};

function fmtDate(iso: string | null) { return iso ? new Date(iso).toLocaleDateString("el-GR") : "—"; }

function StatusPill({ status }: { status: ObligationStatus }) {
  const s = STATUS_STYLE[status];
  return <span style={{ display: "inline-flex", alignItems: "center", fontSize: 11.5, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: s.bg, color: s.fg, whiteSpace: "nowrap" }}>{s.label}</span>;
}

export function ManagedBuildingsClient({ buildings, obligations, recent }: { buildings: ManagedBuildingRow[]; obligations: ObligationRow[]; recent: RecentLogRow[] }) {
  const overdue = useMemo(() => obligations.filter((o) => o.status === "overdue"), [obligations]);
  const dueSoon = useMemo(() => obligations.filter((o) => o.status === "due-soon"), [obligations]);

  const columns: ColDef<ManagedBuildingRow>[] = [
    { id: "name", header: "Κτήριο", accessor: (b) => b.name, cell: (b) => (
      <div>
        <Link href={`/super-admin/buildings/${b.id}`} style={{ fontWeight: 700, color: "var(--foreground)", textDecoration: "none" }}>{b.name}</Link>
        <div style={{ fontSize: 11.5, color: "var(--muted-foreground)" }}>{b.customerName}{b.address ? ` · ${b.address}` : ""}</div>
      </div>
    ) },
    { id: "items", header: "Στοιχεία", accessor: (b) => b.itemCount, cell: (b) => <span style={{ fontVariantNumeric: "tabular-nums" }}>{b.itemCount} <span style={{ color: "var(--muted-foreground)" }}>({b.totalQuantity} τεμ.)</span></span> },
    { id: "schedules", header: "Προγράμματα", accessor: (b) => b.scheduleCount, cell: (b) => <span style={{ fontVariantNumeric: "tabular-nums" }}>{b.scheduleCount}</span> },
    { id: "next", header: "Επόμενη υποχρέωση", accessor: (b) => b.nextDueDate ?? "", cell: (b) => fmtDate(b.nextDueDate) },
    { id: "overdue", header: "Εκπρόθεσμες", accessor: (b) => b.overdueCount, cell: (b) => b.overdueCount > 0
      ? <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 700, color: "#9A2B2B" }}><RiAlarmWarningLine /> {b.overdueCount}</span>
      : <span style={{ color: "var(--muted-foreground)" }}>0</span> },
  ];

  const renderExpanded = (b: ManagedBuildingRow) => {
    const rows = obligations.filter((o) => o.buildingId === b.id);
    const logs = recent.filter((r) => r.buildingId === b.id).slice(0, 5);
    return (
      <div style={{ padding: "12px 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div>
          <div style={sectionTitle}><RiToolsLine /> Προγράμματα συντήρησης</div>
          {rows.length === 0 ? <div style={muted}>Χωρίς προγράμματα</div> : rows.map((o) => (
            <div key={o.taskId} style={rowLine}>
              <span>{o.title}{o.itemName ? ` · ${o.itemName}` : ""}</span>
              <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 8 }}>{fmtDate(o.nextDueDate)} <StatusPill status={o.status} /></span>
            </div>
          ))}
        </div>
        <div>
          <div style={sectionTitle}><RiCalendarCheckLine /> Πρόσφατο ιστορικό</div>
          {logs.length === 0 ? <div style={muted}>Χωρίς καταχωρήσεις</div> : logs.map((l) => (
            <div key={l.id} style={rowLine}>
              <span>{l.title}</span>
              <span style={{ marginLeft: "auto", color: "var(--muted-foreground)" }}>{fmtDate(l.performedAt)}{l.performedBy ? ` · ${l.performedBy}` : ""}</span>
            </div>
          ))}
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <Link href={`/super-admin/buildings/${b.id}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "var(--color-primary)", textDecoration: "none" }}>
            Άνοιγμα καρτέλας κτηρίου <RiExternalLinkLine />
          </Link>
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: "22px 24px 40px", maxWidth: 1240 }}>
      <header style={{ marginBottom: 18 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-.01em", color: "var(--foreground)", display: "flex", alignItems: "center", gap: 9 }}>
          <RiBuilding2Line /> Διαχειριζόμενα κτήρια
        </h1>
        <p style={{ margin: "4px 0 0", fontSize: 13.5, color: "var(--muted-foreground)" }}>Στοιχεία, προγράμματα συντήρησης και υποχρεώσεις των κτηρίων που διαχειρίζεται η εταιρεία.</p>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, marginBottom: 20 }}>
        <StatCard icon={<RiBuilding2Line />} tint="#3B6BB0" value={buildings.length} label="Κτήρια" />
        <StatCard icon={<RiStackLine />} tint="#2E7D5B" value={buildings.reduce((s, b) => s + b.itemCount, 0)} label="Στοιχεία" />
        <StatCard icon={<RiToolsLine />} tint="#9A5B00" value={dueSoon.length} label="Επικείμενες" />
        <StatCard icon={<RiAlarmWarningLine />} tint="#C0392B" value={overdue.length} label="Εκπρόθεσμες" />
      </div>

      {overdue.length > 0 && (
        <section style={panel}>
          <div style={panelTitle}><RiAlarmWarningLine style={{ color: "#C0392B" }} /> Εκπρόθεσμες υποχρεώσεις</div>
          {overdue.map((o) => <ObligationLine key={o.taskId} o={o} />)}
        </section>
      )}
      {dueSoon.length > 0 && (
        <section style={panel}>
          <div style={panelTitle}><RiToolsLine style={{ color: "#9A5B00" }} /> Επικείμενες υποχρεώσεις</div>
          {dueSoon.map((o) => <ObligationLine key={o.taskId} o={o} />)}
        </section>
      )}

      <DataTable
        data={buildings}
        columns={columns}
        totalRows={buildings.length}
        page={1}
        pageSize={25}
        clientSide
        storageKey="managed-buildings"
        searchPlaceholder="Αναζήτηση κτηρίου…"
        expandedContent={renderExpanded}
      />
    </div>
  );
}

function ObligationLine({ o }: { o: ObligationRow }) {
  return (
    <div style={rowLine}>
      <Link href={`/super-admin/buildings/${o.buildingId}`} style={{ fontWeight: 600, color: "var(--foreground)", textDecoration: "none" }}>{o.buildingName}</Link>
      <span style={{ color: "var(--muted-foreground)" }}>· {o.title}{o.itemName ? ` (${o.itemName})` : ""}</span>
      <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 8 }}>{fmtDate(o.nextDueDate)} <StatusPill status={o.status} /></span>
    </div>
  );
}

function StatCard({ icon, tint, value, label }: { icon: React.ReactNode; tint: string; value: number; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px" }}>
      <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 38, height: 38, borderRadius: 10, background: `${tint}1A`, color: tint, flex: "none" }}>{icon}</span>
      <div>
        <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.1, color: "var(--foreground)", fontVariantNumeric: "tabular-nums" }}>{value}</div>
        <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 1 }}>{label}</div>
      </div>
    </div>
  );
}

const panel: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px", marginBottom: 16 };
const panelTitle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700, color: "var(--foreground)", marginBottom: 10 };
const sectionTitle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 700, color: "var(--foreground)", marginBottom: 8 };
const rowLine: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", fontSize: 13, color: "var(--foreground)", padding: "6px 0", borderTop: "1px solid var(--border)" };
const muted: React.CSSProperties = { fontSize: 12.5, color: "var(--muted-foreground)", padding: "6px 0" };
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual smoke**

Run: `npm run dev`. As super-admin, open `/super-admin/managed-buildings` (also reachable from the ΔΙΑΧΕΙΡΙΣΗ sidebar group). Verify: stat cards, overdue/due-soon panels, building table; expand a row → its schedules + recent history + link. Then set the session role to EMPLOYEE (or seed an EMPLOYEE user) and confirm the page + sidebar entry are reachable.

- [ ] **Step 5: Commit**

```bash
git add app/\(company\)/super-admin/managed-buildings
git commit -m "feat(page): managed-buildings obligations dashboard with drill-down"
```

---

## Task 11: Central assignment from the obligations page

The approved design assigns items in **both** the per-building tab (Task 6) and the new page. Here we add an «Ανάθεση στοιχείου» modal that picks a building → item type → common area → location → quantity → optional schedule, reusing `createManagedItem` + `createRecurringTask`. Common areas load on building-select via a small server action.

**Files:**
- Modify: `app/actions/managed-items.ts` (add `listBuildingCommonAreas`)
- Modify: `app/(company)/super-admin/managed-buildings/page.tsx` (pass `itemTypes` + `buildingOptions`)
- Modify: `app/(company)/super-admin/managed-buildings/ManagedBuildingsClient.tsx` (assign modal)

- [ ] **Step 1: Add a common-areas fetch action**

Append to `app/actions/managed-items.ts`:

```ts
export async function listBuildingCommonAreas(buildingId: string): Promise<{ id: string; name: string; floor: number | null }[]> {
  await requireBuildingCap(buildingId, "manageManagedItems");
  return db.commonArea.findMany({ where: { buildingId }, orderBy: [{ floor: "asc" }, { name: "asc" }], select: { id: true, name: true, floor: true } });
}
```

- [ ] **Step 2: Supply item types + building options to the client**

In `app/(company)/super-admin/managed-buildings/page.tsx`, add `db` import and load active types; pass them plus building options to the client:

```tsx
import { db } from "@/lib/db";
```

Extend the `Promise.all` and the render:

```tsx
  const [buildings, obligations, recent, itemTypes] = await Promise.all([
    listManagedBuildings(),
    listUpcomingObligations(),
    listRecentMaintenance(),
    db.managedItemType.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return <ManagedBuildingsClient buildings={buildings} obligations={obligations} recent={recent} itemTypes={itemTypes} />;
```

- [ ] **Step 3: Add the assign modal to the client**

In `ManagedBuildingsClient.tsx`, extend imports and props:

```tsx
import { useMemo, useState, useTransition } from "react";
import { Modal, FormField, FieldSelect } from "@/components/ui/modal";
import { RiAddLine, RiCheckLine, RiLoaderLine, RiCalendarLine } from "react-icons/ri";
import { createManagedItem, listBuildingCommonAreas } from "@/app/actions/managed-items";
import { createRecurringTask, type TaskFrequency } from "@/app/actions/recurring-tasks";
```

Change the component signature and add the button + modal:

```tsx
export function ManagedBuildingsClient({ buildings, obligations, recent, itemTypes }: { buildings: ManagedBuildingRow[]; obligations: ObligationRow[]; recent: RecentLogRow[]; itemTypes: { id: string; name: string }[] }) {
```

Add these hooks near the top of the component body (after the `overdue`/`dueSoon` memos):

```tsx
  const [assignOpen, setAssignOpen] = useState(false);
```

Add an «Ανάθεση στοιχείου» button in the `<header>` (after the `<p>` description), then render the modal before the closing `</div>` of the page:

```tsx
      <button onClick={() => setAssignOpen(true)} style={{ marginTop: 12, display: "inline-flex", alignItems: "center", gap: 7, border: "none", background: "var(--color-primary)", color: "#fff", borderRadius: 6, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
        <RiAddLine /> Ανάθεση στοιχείου
      </button>
```

```tsx
      {assignOpen && <AssignItemModal buildings={buildings} itemTypes={itemTypes} onClose={() => setAssignOpen(false)} />}
```

Add the modal component at the bottom of the file:

```tsx
const FREQ_OPTIONS: { value: TaskFrequency; label: string }[] = [
  { value: "WEEKLY", label: "Εβδομαδιαία" }, { value: "MONTHLY", label: "Μηνιαία" }, { value: "QUARTERLY", label: "Τριμηνιαία" },
  { value: "SEMIANNUAL", label: "Εξαμηνιαία" }, { value: "ANNUAL", label: "Ετήσια" }, { value: "CUSTOM", label: "Προσαρμοσμένη" },
];

function AssignItemModal({ buildings, itemTypes, onClose }: { buildings: ManagedBuildingRow[]; itemTypes: { id: string; name: string }[]; onClose: () => void }) {
  const [buildingId, setBuildingId] = useState("");
  const [areas, setAreas] = useState<{ id: string; name: string; floor: number | null }[]>([]);
  const [form, setForm] = useState({ itemTypeId: "", commonAreaId: "", location: "", quantity: 1 });
  const [sched, setSched] = useState({ enabled: false, frequency: "MONTHLY" as TaskFrequency, nextDueDate: "" });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onBuilding(v: string) {
    setBuildingId(v);
    setForm((p) => ({ ...p, commonAreaId: "" }));
    setAreas([]);
    if (v) startTransition(async () => { setAreas(await listBuildingCommonAreas(v)); });
  }

  function save() {
    setError(null);
    if (!buildingId) { setError("Επίλεξε κτήριο"); return; }
    startTransition(async () => {
      const res = await createManagedItem(buildingId, {
        itemTypeId: form.itemTypeId, location: form.location, quantity: form.quantity,
        commonAreaId: form.commonAreaId || null,
      });
      if (res && "error" in res && res.error) { setError(res.error); return; }
      const itemId = (res as { itemId?: string }).itemId;
      if (itemId && sched.enabled) {
        const sres = await createRecurringTask(buildingId, {
          title: itemTypes.find((t) => t.id === form.itemTypeId)?.name ?? "Συντήρηση",
          frequency: sched.frequency, nextDueDate: sched.nextDueDate || null, managedItemId: itemId, active: true,
        });
        if (sres && "error" in sres && sres.error) { setError(`Το στοιχείο αποθηκεύτηκε, αλλά το πρόγραμμα απέτυχε: ${sres.error}`); return; }
      }
      onClose();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).location?.reload?.();
    });
  }

  return (
    <Modal open onClose={onClose} title="Ανάθεση διαχειριζόμενου στοιχείου" width={520}
      footer={<>
        <button onClick={onClose} style={{ padding: "7px 16px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--card)", cursor: "pointer", fontSize: 13, color: "var(--foreground)" }}>Ακύρωση</button>
        <button onClick={save} disabled={isPending} style={{ padding: "7px 16px", borderRadius: 6, border: "none", background: "var(--color-primary)", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>{isPending ? <RiLoaderLine style={{ animation: "spin 1s linear infinite" }} /> : <RiCheckLine />} Αποθήκευση</button>
      </>}>
      {error && <div style={{ padding: "8px 12px", borderRadius: 6, background: "#fee2e218", color: "#dc2626", fontSize: 12, border: "1px solid #fca5a530", marginBottom: 12 }} role="alert">{error}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <FormField label="Κτήριο" required>
          <FieldSelect value={buildingId} onChange={onBuilding} placeholder="— Επίλεξε κτήριο —" options={buildings.map((b) => ({ value: b.id, label: b.name }))} />
        </FormField>
        <FormField label="Στοιχείο" required hint="Από τον κατάλογο «Στοιχεία Διαχείρισης»">
          <FieldSelect value={form.itemTypeId} onChange={(v) => setForm((p) => ({ ...p, itemTypeId: v }))} placeholder="— Επίλεξε στοιχείο —" options={itemTypes.map((t) => ({ value: t.id, label: t.name }))} />
        </FormField>
        {areas.length > 0 && (
          <FormField label="Κοινόχρηστος χώρος" hint="Προαιρετικό">
            <FieldSelect value={form.commonAreaId} onChange={(v) => setForm((p) => ({ ...p, commonAreaId: v, location: p.location.trim() ? p.location : (areas.find((a) => a.id === v)?.name ?? p.location) }))} placeholder="— Χωρίς σύνδεση —" options={areas.map((a) => ({ value: a.id, label: a.floor != null ? `${a.name} (όροφος ${a.floor})` : a.name }))} />
          </FormField>
        )}
        <FormField label="Τοποθεσία" required>
          <input value={form.location} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))} placeholder="π.χ. Κοινόχρηστοι χώροι" style={{ width: "100%", height: 36, padding: "0 10px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", fontSize: 13, color: "var(--foreground)", background: "var(--card)", outline: "none", boxSizing: "border-box" }} />
        </FormField>
        <FormField label="Ποσότητα" required>
          <input type="number" min={1} value={form.quantity} onChange={(e) => setForm((p) => ({ ...p, quantity: Math.max(1, Math.round(Number(e.target.value)) || 1) }))} style={{ width: 120, height: 36, padding: "0 10px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", fontSize: 13, color: "var(--foreground)", background: "var(--card)", outline: "none", boxSizing: "border-box", textAlign: "center", fontVariantNumeric: "tabular-nums" }} />
        </FormField>
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: "var(--foreground)", cursor: "pointer" }}>
            <input type="checkbox" checked={sched.enabled} onChange={(e) => setSched((p) => ({ ...p, enabled: e.target.checked }))} />
            <RiCalendarLine style={{ color: "var(--muted-foreground)" }} /> Πρόγραμμα συντήρησης
          </label>
          {sched.enabled && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
              <FormField label="Συχνότητα" required>
                <FieldSelect value={sched.frequency} onChange={(v) => setSched((p) => ({ ...p, frequency: v as TaskFrequency }))} options={FREQ_OPTIONS} />
              </FormField>
              <FormField label="Επόμενη ημερομηνία">
                <input type="date" value={sched.nextDueDate} onChange={(e) => setSched((p) => ({ ...p, nextDueDate: e.target.value }))} style={{ width: "100%", height: 36, padding: "0 10px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", fontSize: 13, color: "var(--foreground)", background: "var(--card)", outline: "none", boxSizing: "border-box" }} />
              </FormField>
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </Modal>
  );
}
```

- [ ] **Step 4: Verify the `Modal`/`FormField`/`FieldSelect` import path**

Run: `grep -n "export" components/ui/modal.tsx | grep -E "Modal|FormField|FieldSelect"`
Expected: all three are exported from `@/components/ui/modal` (same path `ManagedItemsPanel.tsx` uses). If the path differs, adjust the import in Step 3.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Manual smoke**

Run: `npm run dev`, open `/super-admin/managed-buildings`, click «Ανάθεση στοιχείου», pick a managed building (areas load), choose a type, area, quantity, enable a schedule, save → the row's counts update after reload; the item shows in the per-building tab too.

- [ ] **Step 7: Commit**

```bash
git add app/actions/managed-items.ts app/\(company\)/super-admin/managed-buildings
git commit -m "feat(page): central managed-item assignment modal on obligations page"
```

---

## Task 12: Full verification pass

- [ ] **Step 1: Run the whole unit suite**

Run: `npm test`
Expected: all pass, including the 3 new test files (RBAC defaults, calendar projection, obligation classifier).

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build succeeds; `/super-admin/managed-buildings` and `/staff/calendar` compile.

- [ ] **Step 4: End-to-end manual check (managed building)**

1. Assign an item to a common area with quantity + a WEEKLY schedule (Task 6 UI).
2. It appears on `/super-admin/managed-buildings` (item count, schedule, next due) and expands to show the schedule.
3. It appears weekly on `/staff/calendar` under «Συντηρήσεις».
4. Complete the task from the building's maintenance panel → `nextDueDate` advances, a `MaintenanceLog` is written, the past calendar occurrence drops, and the completion shows in the obligations «Πρόσφατο ιστορικό».
5. Confirm a **self-managed** (non-managed) building still refuses managed items.

- [ ] **Step 5: Deploy note**

On deploy, `prisma/seed-rbac.ts` runs and `backfillNewModules()` inserts `managed-buildings` defaults for existing system roles (SA/ADMIN/MANAGER/EMPLOYEE) — no manual DB action. The migration from Task 1 applies via `prisma migrate deploy` in the deploy pipeline.

- [ ] **Step 6: Final commit (if any residual changes)**

```bash
git add -A
git commit -m "chore: managed-items maintenance feature — verification fixes"
```

---

## Deferred (not in this plan)

**Τιμολόγηση / billing** of managed items & maintenance toward the customer — explicitly a later milestone. The model stays billing-ready (`MaintenanceLog.cost`, `RecurringTask.inServicePackage`, item→building→customer). Do **not** add pricing UI/flows here.
