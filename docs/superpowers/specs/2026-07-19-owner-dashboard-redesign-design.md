# Owner Dashboard Redesign (dual-role) — Design

**Date:** 2026-07-19 · **Status:** Approved by user

## Goal

`/owner` must serve people who are simultaneously owner of many units and tenant of one — the
current page hides the tenant side, shows a meaningless 100% occupancy, an unreadable chart, and a
fragmented sidebar. Redesign per ui-ux-pro-max guidance (portfolio grid, actionable empty states,
direct chart labeling, tabular numbers) on the existing Orithon tokens.

## Scope (user-approved)

### 1. Data layer — `lib/dashboard/owner-queries.ts` + `lib/dashboard/alloc-view.ts`

- `getOwnerPortfolio(userId)`: owned units with building, floor, sqm, millesimes, tri-state
  tenancy (`SELF` when `residentId === userId`, `RENTED` with resident name, `VACANT`), and
  per-unit unpaid owner € (sum of unpaid `ownerAmount`).
- `getTenantSide(userId)`: units where the user is the resident → building/unit label, unpaid
  tenant balance, latest charge month. Null when not a tenant anywhere.
- Pure helper `duoTrend(rows, months)` in `alloc-view.ts` (TDD): rows
  `{month, owner, tenant}` → per-month `{month, owner, tenant}` aligned to the 6-month window
  (0 for missing months).

### 2. `DuoBars` chart — `components/dashboard/duo-bars.tsx`

SVG grouped bars, two series (Ιδιοκτήτης = `--color-primary`, Ένοικος = `--color-accent`),
direct € value labels above bars (hidden when 0), zero-month baseline dots, visible legend,
month labels, `tabular-nums`, `role="img"` + Greek aria-label summary. No animation. MiniBars
stays for other surfaces.

### 3. `/owner` page rewrite

- Hero: greeting + chips «N μονάδες σε M κτήρια» and, when dual-role, «και ένοικος στη μονάδα X».
- KPI row: Συνολικές οφειλές (owner+tenant) · Ως ιδιοκτήτης € · Ως ένοικος € (rendered only when
  tenant-side exists) · Ανοιχτά αιτήματα. All tiles link somewhere.
- «Το χαρτοφυλάκιό μου»: responsive card grid; each card = unit number + building, tri-state
  `StatusChip` (Ιδιοκατοίκηση neutral/info, Ενοικιασμένο σε {name} success, Κενό warning), meta
  row (όροφος · τ.μ. · χιλιοστά), per-unit unpaid € (tabular), footer links: Κοινόχρηστα →
  `/owner/payments`, Βλάβη → `/owner/requests`. Vacant cards get a subtle warning border.
- Occupancy: stacked horizontal breakdown (rented / self-occupied / vacant) replacing the gauge —
  self-occupation no longer counts as «ενοικιασμένη».
- «Ως ένοικος» card (dual-role only): home unit, unpaid tenant €, latest month, button
  «Πληρωμές ενοίκου» → `/portal/payments`.
- Chart card: `DuoBars` with 6-month owner/tenant charges.
- Open requests list (existing `TicketList`) with actionable empty state.
- `AutoRefresh` mounts stay as-is.

### 4. Sidebar IA + RBAC reconcile

- `lib/rbac/registry.ts`: owner-facing modules move to a single group `assets` («Τα ακίνητά μου»):
  customer-dashboard (role-aware href), customer-units, customer-income, owner-requests,
  owner-announcements; `customer-wallet` stays in `services`. Group label map updated so the
  owner sees: Τα ακίνητά μου + Υπηρεσίες only.
- New `prisma/reconcile-rbac.ts`: for SYSTEM roles only, make `RolePermission` rows exactly match
  the code defaults (delete stale, insert missing). Custom roles untouched. Idempotent; run
  manually now (shared DB) and add alongside seed-rbac in the deploy chain (documented).

## Error handling

Empty portfolio → actionable empty state («Δεν έχουν καταχωρηθεί μονάδες — επικοινωνήστε με τη
διαχείριση»). Chart with no data in window → «Καμία χρέωση στο εξάμηνο» empty state instead of an
empty axis frame.

## Testing / verification

vitest (`duoTrend`, existing suites) · `tsc --noEmit` · `next build` · reconcile script run
against the shared DB then menu spot-check via View-as Λυδία · push to GitHub main afterwards
(standing directive).
