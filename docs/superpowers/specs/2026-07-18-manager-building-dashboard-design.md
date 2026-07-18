# Manager (PROPERTY_ADMIN) Building Dashboard — Design

**Date:** 2026-07-18 · **Status:** Approved by user

## Goal

Make the customer-surface building-manager dashboard (`/building`, role `PROPERTY_ADMIN`) fully
functional. It must expose every capability of the staff building dashboard
(`/super-admin/buildings/[id]` — 19 panels) with better UI/UX, scoped strictly to the manager's own
buildings.

## Decisions (user-approved)

1. **Permissions:** differentiated by `property.managed`.
2. **Implementation:** shared panels + new manager shell (no duplicate panel code).
3. **Navigation:** 6 grouped sections with sub-tabs instead of 19 flat tabs.
4. **Multi-building:** auto-redirect when one building; cards list + header switcher when many.
   Canonical URL `/building/[id]`.

## Architecture

### 1. Access layer — `lib/building-access.ts` (new)

`getBuildingAccess(userId, buildingId)` →
`{ allowed, viewer: "staff" | "manager", managed, can: BuildingCaps } | null`

- Company staff (`SUPER_ADMIN`/`ADMIN`/`MANAGER`): full capabilities (unchanged behavior).
- `PROPERTY_ADMIN`: allowed only for buildings reachable via `ManagementAssignment`
  (direct `buildingId` or via `propertyId`). Otherwise not found.
- `BuildingCaps` flags per domain: `editUnits, editMillesimes, editDistribution, manageExpenses,
  manageKoinochrista, managePayments, manageFiles, manageContacts, manageAnnouncements,
  manageAssemblies, manageCalendar, manageInfra, manageManagedItems, manageMaintenance,
  createRequests, viewAudit`.

Capability matrix for PROPERTY_ADMIN:

| Domain | Managed building | Self-managed building |
|---|---|---|
| Units, people, millesimes, meter readings | view | view + edit |
| Expenses, koinochrista, payments | view | full CRUD |
| Files, contacts, announcements, assemblies, calendar | CRUD | CRUD |
| Fault requests | create + track | full |
| Recurring maintenance, infra points, managed items | view | CRUD |
| Distribution settings, audit log | view | view |

### 2. Server actions hardening

Every mutating action currently guarded by role-only checks gains the shared guard:
`requireBuildingCap(buildingId, cap)` (in `lib/building-access.ts`), which resolves session →
`getBuildingAccess` → throws unless the capability is granted. Actions touched: building-files,
contacts, announcements, assemblies, recurring-tasks, infra-points, managed-items,
building-millesimes, unit-occupants, koinochrista, heating-readings, maintenance-requests,
maintenance-logs, building-expenses (already partially scoped), building-audit (view).
Read paths used by the dashboard are scoped by the same access check at the page level.

### 3. Shared data + panels

- Extract the query pipeline of `super-admin/buildings/[id]/page.tsx` into
  `lib/building/dashboard-data.ts` → `getBuildingDashboardData(buildingId, opts)`, returning the
  exact props shape the panels already consume.
- Move the 19 panels + helpers from `app/(company)/super-admin/buildings/[id]/` to
  `components/building/` unchanged except: accept a `can: BuildingCaps` prop and hide/disable
  mutation UI when the flag is off. Staff dashboard passes all-true caps → zero visual change.
- `BuildingDashboard.tsx` (staff shell) stays where it is, importing the shared panels.

### 4. Manager routes & shell

- `app/(customer)/building/page.tsx`: resolve manager's buildings. 1 → `redirect(/building/[id])`;
  many → overview cards (name, address, units, month collection %, open requests, unpaid €).
- `app/(customer)/building/[id]/page.tsx`: access check → `getBuildingDashboardData` →
  `BuildingManagerShell`.
- `BuildingManagerShell` (`components/building/manager-shell/`): header (building name, address,
  Managed badge, building switcher when >1), 6 sections with sub-tabs, `?s=&t=` URL state:
  1. **Επισκόπηση** — actionable: collections gauge, debtors, paid/unpaid bar, open requests,
     upcoming maintenance, latest announcements, quick actions filtered by caps.
  2. **Οικονομικά** — Κοινόχρηστα · Έξοδα · Πληρωμές · Ενδείξεις μετρητών (+ θέρμανση όταν metered).
  3. **Κτήριο** — Μονάδες · Χιλιοστά & Κατανομή · Ρυθμίσεις κατανομής · Εγκαταστάσεις ·
     Διαχειριζόμενα στοιχεία.
  4. **Άνθρωποι** — Ένοικοι/Ιδιοκτήτες · Επαφές.
  5. **Συντήρηση** — Αιτήματα βλαβών · Συντηρήσεις · Ημερολόγιο.
  6. **Επικοινωνία** — Ανακοινώσεις · Συνελεύσεις · Αρχεία.
- Styling: Orithon tokens, react-icons/ri Line icons, existing dashboard primitives
  (`components/dashboard`), DataTable where lists are tabular.

### 5. Data isolation

All queries filter on the resolved `buildingId`; the access check is the only entry point. No
global user search in occupant pickers on the manager surface (known leak stays staff-only).

## Error handling

- No assignment / foreign building → `notFound()`.
- Capability violation in an action → thrown error surfaced by existing panel toasts.

## Testing / verification

- `tsc --noEmit` + `next build`.
- Manual flow via super-admin View-as PROPERTY_ADMIN: single & multi building, managed vs
  self-managed capability differences, one mutation per section.
- No schema change expected (verify with `prisma migrate diff`).
