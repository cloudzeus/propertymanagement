# Orithon S2 — Persona Dashboards (Owner / Resident / Building Manager)

**Date:** 2026-07-03
**Status:** Approved direction, spec for review
**Surfaces:** `(customer)` — the three revenue-driving end users.

## Goal

Rebuild the three end-user dashboards into a **premium, class-feel** experience on the
Orithon warm-cream design system, with **persona-appropriate content**, **reports &
statistics**, and **prominent open-tickets**. Current pages are structurally identical
(3–4 counter cards + one list + quick actions) using inline styles and off-palette Fluent
colors. They look generic; they must feel bespoke and high-end.

Personas (all in `(customer)` surface):
- **Ιδιοκτήτης** — `PROPERTY_OWNER` → `/owner`
- **Ενοικιαστής** — `PROPERTY_RESIDENT` / `PROPERTY_VIEWER` → `/portal`
- **Διαχειριστής πολυκατοικίας** — `PROPERTY_ADMIN` (building manager) → building dashboard

## Approach

**Shared dashboard kit + persona content.** Build a small set of reusable server-friendly
primitives under `components/dashboard/`, then rebuild each page on top with role-specific
data. Consistency, less code, removes inline-style sprawl.

### Component kit (`components/dashboard/`)
- `Hero` — greeting + contextual summary line + optional primary CTA; subtle warm gradient.
- `StatTile` — label, big serif number, sub, optional trend (▲▼ + %), optional inline sparkline, top accent hairline, hover lift.
- `SectionCard` — titled panel with optional "view all" affordance; `--shadow-card`, radius 12.
- `StatusChip` — semantic status pill (success/warning/danger/neutral).
- `MoneyRow` — a row showing entity + amount + paid/unpaid state (used in collection/history lists).
- `ProgressMeter` — labeled bar (e.g. collection % of month).
- `Donut` — inline-SVG donut (occupancy, paid vs unpaid).
- `Sparkline` / `MiniBars` — inline-SVG trend for the last N months.
- `TicketList` — open-tickets block: title, priority chip, age, status. Shared across personas.
- `EmptyState` — warm empty state.

All are **pure/presentational** (props in, markup out) so they stay server-renderable; only
interactive bits (pay button) are client islands. No client chart library — visuals are
inline SVG.

### Visual language (Orithon "class")
- Canvas `--bg-canvas` (cream, exists). Cards `--card` white + `--shadow-card`, radius-lg tiles.
- **Serif display (Cormorant)** for H1 and the big stat numbers; sans (Commissioner) for labels/body.
- **Single accent: amber `#F2A23C`.** Retire ad-hoc Fluent colors (#0078D4/#8764B8/…). Semantic
  colors (`--color-success/warning/danger`) used ONLY for status.
- Hero with a diagonal warm gradient wash + generous whitespace.
- Hover micro-interactions (tile lift, chip/row hover), visible focus rings, responsive grid
  (tiles collapse 4→2→1; two-column panel area collapses to single column on narrow).

## Persona content

### 🏠 Owner (`/owner`)
- **Hero:** "Καλησπέρα, {name}" · "{N} ακίνητα · {occupancy}% πληρότητα".
- **Stat tiles:** Ιδιοκτησίες (units) · Πληρότητα (Donut occupied/vacant) · **Οφειλές μου**
  (Σ `ExpenseAllocation.ownerAmount` where `ownerPaid=false` for units they own) · Ανοιχτά
  αιτήματα στα ακίνητά μου.
- **Reports/stats:** MiniBars — οφειλές/χρεώσεις ιδιοκτήτη ανά μήνα (last 6).
- **Panels:** Λίστα μονάδων (status chip + υπόλοιπο ανά μονάδα) · **Open tickets** (maintenance
  on their units) · πρόσφατες χρεώσεις.

### 👤 Resident (`/portal`)
- **Hero:** greeting + **big "Υπόλοιπο: €X"** + **«Πληρωμή τώρα»** CTA (Viva) when balance > 0
  (client island). Balance = Σ `ExpenseAllocation.tenantAmount` where `tenantPaid=false` for
  their unit.
- **Stat tiles:** Υπόλοιπο κοινοχρήστων · Τρέχουσα δόση + λήξη · Αιτήματα συντήρησης · Ανακοινώσεις.
- **Reports/stats:** MiniBars — κοινόχρηστα ανά μήνα (last 6), paid vs unpaid shading.
- **Panels:** Ιστορικό κοινοχρήστων (MoneyRow, paid/unpaid) · Ανακοινώσεις (existing) · «Το
  διαμέρισμά μου» (unit info) · **Open tickets** (their requests) · quick actions.

### 🛠️ Building manager (`PROPERTY_ADMIN`)
- **Hero:** building name + κατάσταση κοινοχρήστων τρέχοντος μήνα.
- **Stat tiles:** **Εισπράξεις μήνα** (εισπραγμένα/σύνολο + ProgressMeter) · Οφειλέτες (πλήθος +
  ποσό) · **Ανοιχτά αιτήματα** · Έξοδα μήνα (`BuildingExpense`).
- **Reports/stats:** MiniBars — collection rate ανά μήνα (last 6) · Donut paid vs outstanding.
- **Panels:** **Κατάσταση εισπράξεων ανά μονάδα** (MoneyRow: ποιος πλήρωσε/χρωστά) · **Open
  tickets** (εκκρεμή αιτήματα, priority) · Έξοδα μήνα · Ανακοινώσεις + «Έκδοση κοινοχρήστων».

## Data layer

New server query helpers (colocated per page or in `lib/dashboard/`), all on existing models:
- `ExpenseAllocation` — `tenantAmount/tenantPaid`, `ownerAmount/ownerPaid` (per-unit κοινόχρηστα).
- `BuildingExpense` — monthly building expenses.
- `UnitPayment` — per-unit monthly charge status (PAID/PENDING/OVERDUE).
- `MaintenanceRequest` — open tickets.
- `Announcement` — active announcements.

**Scoping:**
- Owner: units where `ownerId = user.id`.
- Resident: unit where `residentId = user.id`.
- Building manager: buildings via `ManagementAssignment` for `user.id` (property- or
  building-level), NOT the whole company. Last-6-months trends computed by grouping on the
  `month` (YYYY-MM) fields.

## Routing decision (building manager)

Current state is inconsistent: `homePathForRole.PROPERTY_ADMIN = "/portal"`, but the sidebar
nav for `PROPERTY_ADMIN` links Dashboard→`/manager`, and `/manager` lives in `(company)` which
guards out customer roles.

**Decision:** Add a dedicated building-manager dashboard route inside the `(customer)` surface
(e.g. `app/(customer)/building/page.tsx`), scoped by `ManagementAssignment`. Update
`homePathForRole.PROPERTY_ADMIN` and the `PROPERTY_ADMIN` sidebar nav to point there. This
keeps surface guards clean and gives the manager building-scoped data. The existing
`(company)/manager` page remains the company-staff MANAGER view (out of scope for this change
beyond the shared visual kit if trivially applicable).

## Non-goals
- No new payment backend work beyond wiring the existing Viva "pay now" entry point.
- No client-side charting library.
- No redesign of company `admin/staff/super-admin` dashboards.

## Success criteria
- Three dashboards render on the shared kit with zero ad-hoc Fluent colors; serif display in use.
- Each shows persona-correct data incl. real κοινόχρηστα figures, a stats/trend visual, and a
  dedicated open-tickets block.
- Building manager sees building-scoped data via a clean `(customer)` route.
- Responsive (4→2→1), accessible (focus rings, contrast), empty states handled.
