# Two-Tier API Cost Tracking with Per-API Markup

**Date:** 2026-06-20
**Status:** Approved (design)

## Problem

The super-admin costs page (`/super-admin/settings/costs`) is incomplete:

- It lists only **4** of the **6** APIs tracked in the backend (missing **Daily** and **Deepgram**).
- It shows only the bare `costModel` string — no actual rate or free quota.
- The page and `lib/api-costs.ts` each keep their **own hardcoded copy** of pricing, so they drift.

Business need: super-admins must see the **real cost** of external APIs / AI tools, set a **markup** per API, and have company admins see only the resulting **billed cost** (real + markup) — never the real cost or the markup itself.

## Decisions

- **Markup model:** per-API percentage. Billed = `realCost × (1 + markupPercent/100)`.
- **Source of truth:** the `APICostConfig` DB table. `DEFAULT_API_COSTS` in `lib/api-costs.ts` is retained only as the seed for `initializeAPICostConfigs()`.
- **Markup default:** `0%` for every API. Super-admins set per-API values explicitly.
- **Markup is applied at display time** from the current config (not frozen into `APIUsageLog`). Changing a markup re-prices historical usage in the billed view. This is acceptable for an internal cost/billing view and keeps `APIUsageLog.totalCost` as a single honest record of real cost.

## Data Model

Add one field to `APICostConfig`:

```prisma
markupPercent  Float  @default(0)   // % added on top of real cost for admin-facing billing
```

A migration adds the column. `APIUsageLog.totalCost` continues to store **real cost only** — unchanged.

## Components

### 1. `lib/api-costs.ts`

- **`getConfig(apiName)`** — reads the `APICostConfig` row from DB, falling back to `DEFAULT_API_COSTS` when no row exists. Becomes the single accessor for pricing.
- **`logAPIUsage()`** — uses `getConfig()` for `basePrice` / `freeQuota` so super-admin edits take effect for new usage. Still writes real cost to `APIUsageLog.totalCost`.
- **`getBilledCost(config, realCost)`** — returns `realCost × (1 + config.markupPercent/100)`.
- Summary helpers (`getAllAPICosts`, `getAPISpecificCosts`, `getMonthlyCosts`) gain an option to also return the billed total, computed via `getBilledCost`. Real and billed are returned as separate fields so callers choose what to expose.

### 2. Config API route — `app/api/super-admin/costs/config/route.ts`

- `GET` → returns all `APICostConfig` rows (seeding defaults on first call via `initializeAPICostConfigs()` if empty). Super-admin gated.
- `PUT` → upserts one config: editable fields `basePrice`, `freeQuota`, `markupPercent`, `monthlyBudgetLimit`, `enabled`. Sets `updatedBy` = current super-admin id. Super-admin gated.

### 3. Super-admin page — `/super-admin/settings/costs`

- Removes its local `DEFAULT_API_COSTS` copy; fetches config from `GET /api/super-admin/costs/config`, so **all 6 APIs** render automatically.
- Per API displays: **real cost**, **markup %**, **billed cost** side by side, plus existing usage metrics.
- **Inline edit** of `basePrice`, `freeQuota`, `markupPercent`, `monthlyBudgetLimit`, `enabled` → `PUT` → persists. Optimistic refresh after save.
- Gated `SUPER_ADMIN` (existing layout).

### 4. Admin-facing page — `app/(dashboard)/admin/costs/page.tsx` (new)

- Lives in the existing `admin/` route group (already gated `SUPER_ADMIN` + `ADMIN`).
- Shows **only the billed cost** per API and totals — never real cost, never markup %.
- Filtered to the signed-in admin's `companyId`.
- Reuses summary logic, mapping every cost through `getBilledCost`.
- A nav entry is added to the admin sidebar.

## Data Flow

```
External API call
  → logAPIUsage() reads APICostConfig (real basePrice/freeQuota)
  → APIUsageLog.totalCost = REAL cost

Super-admin view:
  GET /api/super-admin/costs/config + usage summaries
  → shows realCost, markupPercent, billedCost   (edit → PUT → APICostConfig)

Admin view:
  usage summaries for own companyId
  → each totalCost mapped through getBilledCost()
  → shows billedCost only
```

## Error Handling

- `getConfig()` falls back to `DEFAULT_API_COSTS` if the DB row is missing; logs a warning for unknown API names (existing behaviour).
- Config `PUT` validates numeric fields (`>= 0`) and rejects unknown `apiName`.
- Both routes return 403 for non-super-admin sessions.
- Admin page never receives real-cost or markup fields from the server (billed value computed server-side) to avoid leaking margins to the client.

## Testing

- Extend `lib/api-costs.test.ts`:
  - `getBilledCost` math across markup values (0%, 30%, fractional).
  - `getConfig` DB-row-vs-default fallback.
  - `logAPIUsage` writes real cost (markup not baked in).
  - Summary helpers return real and billed separately.
- Manual: edit a markup as super-admin → confirm admin page billed total changes; confirm admin response payload contains no real-cost/markup fields.

## Out of Scope

- Historical markup freezing / invoicing.
- Currency other than EUR.
- Per-company differentiated markup (markup is global-per-API for now).
