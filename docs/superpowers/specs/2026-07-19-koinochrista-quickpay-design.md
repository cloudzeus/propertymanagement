# Κοινόχρηστα Quick-Pay (Viva) — Design

**Date:** 2026-07-19 · **Status:** Approved by user

## Goal

Quick-pay buttons on the occupant control-center overview (`/building/[id]`, viewer occupant) for
fast κοινόχρηστα payment via Viva — one button per unit for the user's own payable, plus a
«Πληρωμή όλων». Full flow, gated behind a feature flag (default OFF) because Viva is
unverified and the wallet callback is insecure; goes live once Viva is verified in sandbox and the
callback is confirmed.

## Decisions (user-approved)

1. **Full flow behind a feature flag** — UI + intent route + verified callback, disabled until Viva
   is ready (button shows «Σύντομα διαθέσιμο» when off).
2. **Per-unit**: one button = the user's role-aware payable for that unit + a «Πληρωμή όλων».

## Safety principles (non-negotiable)

- **Amount is computed server-side** from the occupant's own unpaid `ExpenseAllocation` rows; the
  client never sends an amount.
- **Access**: the payer must be owner/resident of the unit (reuse `getBuildingAccess` occupant +
  own-unit check).
- **Reconciliation** onto `ExpenseAllocation.{ownerPaid,tenantPaid}` (the statement's source of
  truth), `paidAt`, `{owner,tenant}PaymentMethod = VIVA` — the callback marks paid only after
  **re-fetching and verifying the transaction against Viva** (status + amount), and is idempotent.
- **Gated OFF** by default; no live payment path until `isKoinochristaPayEnabled()` is true.
- **No schema migration**: reuse existing `ExpenseAllocation` fields + `ExpensePaymentMethod` enum
  (verify it has/needs `VIVA`; if the enum lacks it, add via the project's migrate-diff flow — a
  single enum value; otherwise avoid schema change entirely). No new model.

## Architecture

### 1. Feature flag + amount — `lib/payments/koinochrista-pay.ts`

- `isKoinochristaPayEnabled(): boolean` = `process.env.VIVA_KOINOCHRISTA_ENABLED === "true"` AND the
  required `VIVA_*` env present (`VIVA_CLIENT_ID`/`VIVA_CLIENT_SECRET`). Default false.
- `getUnitOutstanding(userId, buildingId, unitId): { amountCents, allocationIds, side }` — resolves
  the viewer's relation to the unit (owner/resident/both), sums the **unpaid** allocations for the
  viewer's side(s) across all issued months, returns the amount + the exact allocation ids the
  payment will settle. `getBuildingOutstanding(userId, buildingId)` → per-unit list + total.
  Building-scoped, own units only.

### 2. Intent route — `app/api/koinochrista/pay/route.ts`

`POST { buildingId, unitId? }` (unitId omitted → pay-all for the building). Server:
- resolve occupant access (403 otherwise); `if (!isKoinochristaPayEnabled()) return 503 { disabled }`.
- compute outstanding server-side (`getUnitOutstanding`/`getBuildingOutstanding`); if 0 → 400.
- `merchantTrns = koino:{buildingId}:{userId}:{side}:{unitId|all}` (identifies the payer + scope; the
  callback recomputes the allocations, so no amount is trusted from the round-trip).
- `createVivaOrder({ amountCents, customerTrns: "Κοινόχρηστα {building}", merchantTrns })` → return
  `{ checkoutUrl }`. Errors → 502.

### 3. Callback — `app/api/koinochrista/callback/route.ts`

GET handshake (reuse the wallet pattern). POST (Viva success event):
- parse `merchantTrns` (must match the `koino:` shape) → buildingId, userId, side, scope.
- **Verify**: re-fetch the transaction from Viva by `TransactionId` (`GET {api}/checkout/v2/transactions/{id}` with a bearer token) and confirm it is a successful capture and the amount equals the server-recomputed outstanding (± the rounding tolerance). Reject on mismatch (401/400). This closes the insecure-callback gap for THIS flow.
- re-verify the user still owns/rents the unit(s); recompute the unpaid allocation ids; mark the
  viewer's side paid (`ownerPaid`/`tenantPaid = true`, `paidAt = now`, method VIVA) — idempotent
  (skip already-paid). `revalidatePath("/building/${buildingId}")` and publish the realtime
  `payment` event so screens refresh.

### 4. UI — occupant overview quick-pay

In `OccupantBuildingShell` overview: a «Γρήγορη πληρωμή» card. Server (occupant page) passes
per-unit outstanding + total (from `getBuildingOutstanding`) and `payEnabled`
(`isKoinochristaPayEnabled()`). Per unit with outstanding > 0: a button «Πληρωμή {amount} με Viva»;
plus «Πληρωμή όλων {total}» when >1 unit owes. Client `QuickPayButtons` POSTs to
`/api/koinochrista/pay` and `window.location = checkoutUrl` on success. When `payEnabled` is false:
buttons render disabled with «Σύντομα διαθέσιμο» + a tooltip. Units with 0 outstanding show
«Εξοφλημένο». Orithon tokens, Ri Line icons, tabular-nums.

### 5. Env

`.env` documents (not committed): `VIVA_KOINOCHRISTA_ENABLED=false`, and the existing
`VIVA_CLIENT_ID/SECRET/ENV/SOURCE_CODE/MERCHANT_ID/API_KEY/WEBHOOK_KEY`. `NEXT_PUBLIC_SITE_URL` for
absolute return URLs if needed.

## Isolation

Occupant-only; amounts + allocations server-computed; callback verified against Viva; own units
only; no cross-unit settlement. `viewLedger` gating untouched.

## Testing / verification

- vitest for `getUnitOutstanding` allocation selection (pure-ish; mock db or extract the reducer).
- `isKoinochristaPayEnabled()` false by default → UI shows «Σύντομα διαθέσιμο», route returns 503.
- tsc/build; dev smoke (flag off): overview shows the card disabled; POST /api/koinochrista/pay → 503.
- Manual sandbox verification of the live path is a SEPARATE step before flipping the flag (documented, not done here).
- Final review incl. a dedicated security pass on the money flow; push.
