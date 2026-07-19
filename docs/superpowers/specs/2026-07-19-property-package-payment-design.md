# Property Package Selection + Payment — Design (sub-project 4)

**Date:** 2026-07-19 · **Status:** Approved by user ("ναι σε όλα όπως θέλεις")

## Goal

On the manager «Ρυθμίσεις», let SUPER_ADMIN/ADMIN/MANAGER-with-access select the property's service
packages and **pay the monthly package on behalf of the property** via the PROVIDER's Viva account
(sub-project 3). Produces a `ServiceInvoice`. Gated on the provider Viva being configured.

## Decisions

- Package selection reuses `PropertyService` (enable/disable per property). Access relaxed from
  SUPER_ADMIN-only to `canManagePropertyViva` (SUPER_ADMIN/ADMIN/MANAGER-with-access).
- Payment goes to the PROVIDER's Viva (the SaaS provider collects); creates a `ServiceInvoice`
  (customerId, period, amount, vivaOrderRef) marked PAID on a verified callback.
- Amount = sum of active services × pricing-model multiplier. METERED_PREPAID excluded from the
  monthly total (prepaid handled separately, unchanged).

## Architecture

### 1. Amount calculator — `lib/billing/service-amount.ts` (TDD pure core)

`serviceLineAmount(service, counts): number` where `counts = { units, buildings, commonAreas }`:
- PER_UNIT → price × units; PER_BUILDING → price × buildings; PER_COMMON_AREA → price × commonAreas;
  FLAT → price; METERED_PREPAID → 0.
`computePackageTotal(lines): { lines: {serviceId,name,pricingModel,unitPrice,qty,amount}[]; totalCents }`.
DB wrapper `getPropertyPackage(propertyId)`: loads active `PropertyService`→`Service`, the property's
counts (units across buildings, buildings, common areas), returns the per-line + total + currency
(EUR). All server-side; Decimals→Number; cents integer for payment.

### 2. Package selection action — relax `app/actions/property-package.ts`

Replace `requireSuperAdmin` in `setPropertyService`/`addPrepaidMinutes` with
`requirePropertyAccess(propertyId)` = `canManagePropertyViva` (from sub-project 1). Add
`revalidatePath('/building/[buildings]')`. Add `listPropertyPackage(propertyId)` (guarded) returning
available services (company catalog, active) + which are enabled for the property + the computed
line/total.

### 3. Payment intent — `app/api/property/package/pay/route.ts`

`POST { propertyId }`. Guard `canManagePropertyViva`. Resolve provider config
(`getProviderVivaConfig()`) → 503 when null (provider Viva not configured). Compute the amount
server-side (`getPropertyPackage`); period = current `YYYY-MM`. Upsert a `ServiceInvoice`
(customerId = property.customer, period, amount, status PENDING) — one per (customer, period)
(model @@unique) with lines from the package; if already PAID for the period → 400 `already_paid`.
`merchantTrns = pkg:{propertyId}:{customerId}:{period}`; `createVivaOrderFor(providerCfg, { amountCents,
customerTrns: "Πακέτο υπηρεσιών {property}", merchantTrns })` → `{ checkoutUrl }`. Amount never from
client.

### 4. Callback — `app/api/property/package/callback/route.ts`

GET handshake (provider creds, like wallet). POST: parse `merchantTrns` (`^pkg:…`) →
propertyId/customerId/period + `TransactionId`. Verify via `getVivaTransactionFor(providerCfg, id)`:
success status + merchantTrns match + amount ≈ the recomputed invoice amount. Mark the
`ServiceInvoice` PAID (`paidAt`, `vivaOrderRef = TransactionId`), idempotent (skip if already PAID).
Never 500.

### 5. UI — manager «Ρυθμίσεις → Πακέτα»

New tab in the settings section (`?s=settings&t=packages`): `components/property/PropertyPackages.tsx`
— list services with per-line qty×price, toggles (enable/disable → `setPropertyService`), monthly
total, current-period invoice status (Εκκρεμεί/Εξοφλημένο), and a «Πληρωμή πακέτου» button (POST the
intent → `window.location = checkoutUrl`; disabled with «Το Viva του παρόχου δεν έχει ρυθμιστεί» when
provider not configured). Also mount on the super-admin property page. Orithon tokens, Ri Line,
tabular-nums.

## Isolation & safety

Amount server-computed; provider-Viva-gated (OFF until configured); access `canManagePropertyViva`
(manager only their property); callback verified + idempotent; invoice unique per (customer, period).
Provider Viva collects (correct direction); per-property κοινόχρηστα routing untouched.

## Testing / verification

- vitest: `serviceLineAmount` per pricing model; `computePackageTotal`.
- Guard: owner/resident → setPropertyService/pay Forbidden; provider not configured → pay 503.
- tsc/build; dev smoke (provider unconfigured): packages tab lists + toggles work; «Πληρωμή» disabled.
- Security review (amount not client-trusted, verified callback, access, gating); push. Completes the
  4-part Viva program.
