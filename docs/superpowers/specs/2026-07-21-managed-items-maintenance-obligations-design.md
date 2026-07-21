# Managed Items → Maintenance → Obligations & Calendar

**Date:** 2026-07-21
**Status:** Approved (design), pending implementation plan

## Problem

Company roles (super-admin / admin / manager / employee) manage physical items in managed
buildings (light replacement, cleaning, etc.). Today we have:

- `ManagedItemType` — company catalog at `/super-admin/managed-items`.
- `ManagedItem` — assigns a type to a **building** with free-text `location`, `floorLabel`,
  `quantity`, photo. Editable only from each building's tab; gated SUPER_ADMIN/ADMIN/MANAGER.
- `RecurringTask` + `MaintenanceLog` — per-building recurring maintenance with `frequency`,
  `nextDueDate`, `lastDoneDate`, `kind`, `vendor`, reminders cron, and due-date advancement on
  completion. **Not linked to managed items and not shown on any calendar.**
- `/staff/calendar` — shows only sales *demo bookings*.

Gaps to close:

1. Assign an item to a **common area** (not just free text), from a central place as well as the
   per-building tab, with quantity.
2. Attach a **maintenance schedule** (e.g. "καθαρισμός κάθε εβδομάδα") to an item.
3. An **obligations dashboard** listing managed buildings and what's due.
4. Surface schedules on the **company calendar**.
5. Widen the assignment ability to **EMPLOYEE**.

## Decisions (from brainstorming)

- Maintenance schedule attaches **to the managed item** (extend `RecurringTask`), not a separate
  building-only concept.
- Common area is a **real `CommonArea` FK** on `ManagedItem`.
- Maintenance appears in the **existing `/staff/calendar`** as a second, colour-coded event type.
- Assignment happens in **both** the per-building tab and a new central page.
- New page shows: managed-building list, upcoming obligations, history/logs, and per-building
  drill-down.

## Non-goals / YAGNI

- No separate maintenance calendar page — reuse `/staff/calendar`.
- No RecurringTask that points directly at a CommonArea with no item (chain is
  schedule → item → area).
- No new completion/reminder mechanics — reuse existing `maintenance-logs.ts` + cron.

---

## Part 1 — Data model (additive, nullable)

```prisma
model ManagedItem {
  // ...existing...
  commonAreaId String?
  commonArea   CommonArea? @relation(fields: [commonAreaId], references: [id], onDelete: SetNull)
  tasks        RecurringTask[]
  @@index([commonAreaId])
}

model RecurringTask {
  // ...existing...
  managedItemId String?
  managedItem   ManagedItem? @relation(fields: [managedItemId], references: [id], onDelete: SetNull)
  @@index([managedItemId])
}

model CommonArea {
  // ...existing...
  managedItems ManagedItem[]
}
```

- `location` (free text) stays as an optional label/fallback; the CommonArea dropdown is the
  structured link.
- `RecurringTask.managedItemId` null = building-level task (unchanged behaviour); set = item-level.
- Migration via `prisma migrate diff --from-config-datasource prisma.config.ts --to-schema
  prisma/schema.prisma --script` then `migrate deploy` (per project convention; **do not**
  `migrate dev`). Regenerate the custom client in `lib/prisma`.

## Part 2 — Assignment flow

**`components/building/ManagedItemsPanel.tsx`**

- Add a **CommonArea `<select>`** populated from the building's `CommonArea[]` (passed from the
  loader). Free-text `location` remains editable as a label.
- Add an inline **«Συντήρηση»** sub-section on the item editor to create/edit a `RecurringTask`
  linked via `managedItemId` (fields: title default = item type name, `frequency`,
  `nextDueDate`, `vendor`, `reminderDaysBefore`, `active`). Reuses `app/actions/recurring-tasks.ts`.

**Server actions**

- `app/actions/managed-items.ts`: accept/persist `commonAreaId` (validate the area belongs to the
  same building). Loader (`lib/building/dashboard-data.ts` / occupant-data) returns the building's
  common areas + each item's linked schedule summary.
- `app/actions/recurring-tasks.ts`: `createRecurringTask`/`updateRecurringTask` accept optional
  `managedItemId` (validate the item belongs to the same building).

**Access widening (EMPLOYEE)**

- `lib/building-caps.ts` (and `building-access`): grant `manageManagedItems` and
  `manageMaintenance` to EMPLOYEE on **managed** buildings.
- `lib/rbac/registry.ts` `DEFAULT_PERMISSIONS.EMPLOYEE`: add `crud("managed-items", "maintenance")`
  and `view("managed-buildings")`.
- Assignment still refuses non-managed buildings (unchanged guard).

## Part 3 — New page `/super-admin/managed-buildings` («Διαχειριζόμενα κτήρια»)

**RBAC**: new module in `lib/rbac/registry.ts`:
`{ key: "managed-buildings", label: "Διαχειριζόμενα κτήρια", surface: "company",
   menu: { href: "/super-admin/managed-buildings", icon: "RiBuilding2Line", group: "management" },
   actions: [...CRUD] }`. Visible to SUPER_ADMIN / ADMIN / MANAGER / EMPLOYEE (view).

**Data layer** `lib/dashboard/managed-buildings.ts` (server):

- `listManagedBuildings()` → per building (`property.managed = true`): name, customer, #items,
  total quantity, #active schedules, next obligation date, overdue count. Respects company-role
  scoping / data isolation (managed buildings only).
- `listUpcomingObligations()` → active RecurringTasks across managed buildings with `nextDueDate`,
  flagged `overdue` (past) / `dueSoon` (within N days), building + item context.
- `listRecentMaintenance()` → company-wide recent `MaintenanceLog` feed.
- Per-building drill-down reuses `listMaintenanceHistory(buildingId)` + item/schedule list.

**UI** (`ManagedBuildingsClient.tsx`, `DataTable`):

1. **Λίστα managed κτηρίων** — one row/building with the counts above + overdue badge.
2. **Επερχόμενες υποχρεώσεις** — overdue/due-soon tasks, grouped, colour-coded.
3. **Drill-down** — `DataTable` `expandedContent`: items + schedules + recent logs for that
   building, plus a link to the full building dashboard (`/super-admin/buildings/[id]` /
   `/building/[id]`).
4. **Ιστορικό/logs** — recent completions feed.

Central **assign** action on this page: pick building → common area → item type → quantity →
optional schedule (reuses the Part 2 actions).

## Part 4 — Calendar integration (`/staff/calendar`)

**Feed** `lib/dashboard/maintenance-calendar.ts`:

- `listMaintenanceCalendar(from, to)` — for each active RecurringTask across managed buildings,
  **project occurrences forward** from `nextDueDate` (or `lastDoneDate`) by `frequency` until
  `to`; include a past occurrence flagged `overdue` when `nextDueDate < from`/now. CUSTOM
  frequency = single event on its date. Each event: `{ id, taskId, buildingId, buildingName,
  title, kind, itemName?, date, overdue }`.

**Page** `app/(company)/staff/calendar/page.tsx` + `DemoCalendarClient.tsx`:

- Load both `listDemoRequests` and `listMaintenanceCalendar` for the window.
- Extend the client to render **two event types** (demo booking vs maintenance), colour-coded,
  with a simple filter toggle. Click a maintenance event → link to its building.
- Gate: unchanged — the page already allows `calendar` OR `mkt-calendar` view, which covers all
  four roles today (EMPLOYEE via `mkt-calendar`). No RBAC change needed for the calendar itself.

---

## Testing

- Prisma migration applies cleanly; client regenerates; existing building/maintenance flows
  unchanged when `managedItemId`/`commonAreaId` are null.
- Assign item to a common area + attach a weekly schedule → appears on the item, on the
  obligations page, and on `/staff/calendar` weekly.
- Completing a task advances `nextDueDate` (existing logic) and drops the past calendar occurrence.
- EMPLOYEE can assign/manage on a managed building; still blocked on non-managed buildings.
- Data isolation: only the current company's managed buildings appear (no cross-customer leak).
- TypeScript compiles; HTTP smoke test of the new page + calendar.

## Affected files (indicative)

- `prisma/schema.prisma` (+ migration)
- `app/actions/managed-items.ts`, `app/actions/recurring-tasks.ts`
- `components/building/ManagedItemsPanel.tsx`
- `lib/building-caps.ts`, `lib/building-access.ts`, `lib/rbac/registry.ts`
- `lib/building/dashboard-data.ts` (+ occupant-data loader for area list)
- `lib/dashboard/managed-buildings.ts` (new), `lib/dashboard/maintenance-calendar.ts` (new)
- `app/(company)/super-admin/managed-buildings/page.tsx` + `ManagedBuildingsClient.tsx` (new)
- `app/(company)/staff/calendar/page.tsx`, `app/(company)/staff/calendar/DemoCalendarClient.tsx`
