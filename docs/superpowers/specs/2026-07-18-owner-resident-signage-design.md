# Owner, Resident & Digital-Signage Surfaces — Design

**Date:** 2026-07-18 · **Status:** Approved by user

## Goal

Extend the shipped building-dashboard program to the remaining customer roles: a functional
PROPERTY_OWNER surface (`/owner`), a completed PROPERTY_RESIDENT portal (`/portal`), and a new
digital-signage surface for PROPERTY_VIEWER (`/signage`). Fix View-as demo accounts showing wrong
(empty) data.

## Decisions (user-approved)

1. **Owner:** dashboard + 4 sub-pages (units, payments, requests, announcements+files).
2. **Resident:** add payments + files pages, fix effective session, make `/portal/maintenance`
   read-only.
3. **Signage:** all four content blocks — announcements/maintenance/assemblies, manager &
   emergency contacts, clock/date/weather, aggregate collection % (no per-unit data).
4. **Viewer↔building link:** `ManagementAssignment` (no schema change).

## Root cause of the demo/View-as issue

`/owner` and `/portal` pages read `auth()` (real session). During super-admin View-as the real id
owns no units → empty dashboards. `/building` was already fixed to use `getEffectiveSession()`;
the same fix applies to every customer-surface page. Additionally, no PROPERTY_VIEWER user exists
in the DB, so signage cannot be demoed at all.

## Architecture

### 1. Horizontal: effective session + demo viewer

- Every page under `app/(customer)/` resolves the user via `getEffectiveSession()` from
  `@/lib/auth-effective` (id = impersonated target when View-as is active).
- New seed script `prisma/seed-demo-viewer.ts`: idempotently creates a `PROPERTY_VIEWER` user
  (`signage-demo@…`, customer = the existing demo customer) plus a `ManagementAssignment` to one
  managed building, so View-as PROPERTY_VIEWER lands on a populated signage screen.

### 2. Owner surface — `lib/dashboard/owner-queries.ts` + pages

All queries filter strictly by the effective user id (`ownerId = userId`); no cross-customer or
cross-owner reads. Pages (server components, Orithon tokens, `components/dashboard` primitives):

- `/owner` (existing dashboard): switch to effective session; links point at the new sub-pages.
- `/owner/units`: table of owned units — building, floor, sqm, millesimes, occupancy status,
  current resident name, and expandable occupancy history (`UnitOccupancy` rows for the unit).
- `/owner/payments`: owner-side charges (`expenseAllocation.ownerAmount/ownerPaid`) grouped by
  month with per-unit rows, paid/unpaid badges, running totals, unpaid sum tile.
- `/owner/requests`: maintenance requests for the owner's units (reported by anyone) +
  `NewRequestButton` constrained to the owner's buildings/units; detail links to
  `/portal/requests/[id]` (route already authorizes owners via `canAccessRequest`).
- `/owner/announcements`: active announcements + building files (read-only; exclude internal
  categories — only `REGULATION`, `MINUTES`, `NOTICE`, `OTHER`-class public categories; exact
  enum values checked at implementation and listed in the plan) for buildings where the user owns
  a unit.

### 3. Resident portal — completion

- `/portal/payments` (new): full tenant charge history (`tenantAmount/tenantPaid` per month,
  description, receipt link when the allocation's expense has a stored receipt file).
- `/portal/files` (new): read-only building files of the resident's building(s), same public
  category filter as the owner page.
- `/portal`, `/portal/announcements`, `/portal/requests`, `/portal/wallet`: effective session fix
  only.
- `/portal/maintenance`: replace the staff panels (CalendarPanel/MaintenanceTab with mutation
  caps) with a read-only schedule view: upcoming recurring tasks + maintenance history of the
  resident's building(s). No mutation UI for residents.

### 4. Signage surface — `app/(signage)/signage/`

- Own route group + layout: fullscreen, dark (Orithon dark tokens), no AppShell/sidebar, no
  interactive chrome; `<html>`-level font scaling for TV readability.
- Access: session role `PROPERTY_VIEWER` (via effective session) → buildings from
  `ManagementAssignment`; staff roles may open it too (preview). Others → redirect to their home.
  Multiple buildings: `?building=<id>` selects; default = first assignment.
- `lib/surfaces.ts`: `PROPERTY_VIEWER` home → `/signage`.
- Server page fetches per building: active announcements; upcoming recurring tasks (next 5);
  next scheduled assembly; current-month collection aggregate (% only); building contacts
  (category-tagged emergency/manager first); building lat/lng.
- Weather: Open-Meteo (`https://api.open-meteo.com/v1/forecast?latitude=…&longitude=…&current=temperature_2m,weather_code`),
  no API key, `next: { revalidate: 1800 }`, graceful skip when no coords or fetch fails.
- Client `SignageBoard` component: clock ticking each second; announcement rotation every 12 s;
  `router.refresh()` every 60 s. Layout: header (building name · clock/date · weather), main
  column (rotating announcement card), side column (upcoming maintenance, next assembly,
  collection gauge), footer ticker (contacts/emergency numbers).
- No sensitive data ever: no per-unit amounts, no debtor names, no personal data beyond contact
  names/phones already meant for the lobby.

### 5. Data isolation

Owner/resident queries key on the effective user's unit relations; signage keys on
ManagementAssignment buildings and shows only aggregate/public data. No global searches.

## Error handling

- No units/assignments → friendly empty states (signage: neutral "no content" board).
- Weather/API failures → block hidden, screen keeps working.

## Testing / verification

- vitest (existing suites) + `tsc --noEmit` + `next build`.
- View-as each of the four demo roles → correct populated screens.
- Runtime smoke: routes redirect unauthenticated to login; signage renders for viewer.
- No schema change (`prisma migrate diff` stays empty apart from unrelated uncommitted work).
