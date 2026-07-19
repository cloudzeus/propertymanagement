# Property Package Selection + Payment Implementation Plan (sub-project 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.

**Goal:** Manager «Ρυθμίσεις → Πακέτα» — select the property's services and pay the monthly package via the PROVIDER's Viva → ServiceInvoice. Gated on provider Viva configured.

**Spec:** `docs/superpowers/specs/2026-07-19-property-package-payment-design.md`

Conventions: branch `main`; stage only touched files; trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`. Ignore pre-existing failures (auth.ts, otp.ts, prisma.config.ts, seed.ts, costs routes, ForgotPasswordForm, landing-types.test).

Facts: `Service{ companyId, name, code, pricingModel(PER_UNIT|PER_BUILDING|PER_COMMON_AREA|FLAT|METERED_PREPAID), price Decimal, active }`. `PropertyService{ propertyId, serviceId, active, prepaidPersonMinutes } @@unique([propertyId,serviceId])`. `Property{ customerId, buildings Building[] }`; `Building{ commonAreas CommonArea[], units Unit[] }`. `ServiceInvoice{ customerId, period, amount Decimal, status(InvoiceStatus PENDING/…/PAID?), issuedAt, paidAt, vivaOrderRef } @@unique([customerId,period]); lines ServiceInvoiceLine[]`. `canManagePropertyViva(userId, propertyId)` in `lib/property-access.ts`. Provider Viva: `getProviderVivaConfig()` (`lib/payments/provider-viva.ts`), `createVivaOrderFor(cfg, input)` + `getAccessTokenFor(cfg)` in `lib/viva.ts`. `app/actions/property-package.ts` (setPropertyService/addPrepaidMinutes, currently requireSuperAdmin). Manager settings section «Ρυθμίσεις» (`?s=settings`) added in sub-project 2. Verify `InvoiceStatus` enum values (grep).

---

### Task 1: Amount calculator (TDD) + package loader

**Files:** Create `lib/billing/service-amount.ts` + `lib/billing/service-amount.test.ts`.

- [ ] **Step 1:** Failing test:
```ts
import { describe, it, expect } from "vitest";
import { serviceLineAmount, computePackageTotal } from "./service-amount";

const svc = (o: Partial<{ id: string; name: string; pricingModel: string; price: number }>) =>
  ({ id: "s", name: "Svc", pricingModel: "FLAT", price: 10, ...o }) as any;
const counts = { units: 4, buildings: 2, commonAreas: 3 };

describe("serviceLineAmount", () => {
  it("multiplies by the right count", () => {
    expect(serviceLineAmount(svc({ pricingModel: "PER_UNIT", price: 2 }), counts)).toBe(8);
    expect(serviceLineAmount(svc({ pricingModel: "PER_BUILDING", price: 5 }), counts)).toBe(10);
    expect(serviceLineAmount(svc({ pricingModel: "PER_COMMON_AREA", price: 3 }), counts)).toBe(9);
    expect(serviceLineAmount(svc({ pricingModel: "FLAT", price: 12 }), counts)).toBe(12);
    expect(serviceLineAmount(svc({ pricingModel: "METERED_PREPAID", price: 99 }), counts)).toBe(0);
  });
});
describe("computePackageTotal", () => {
  it("sums lines and totals cents", () => {
    const r = computePackageTotal([svc({ id: "a", pricingModel: "PER_UNIT", price: 2 }), svc({ id: "b", pricingModel: "FLAT", price: 12 })], counts);
    expect(r.totalCents).toBe(2000);
    expect(r.lines.map((l) => l.amount)).toEqual([8, 12]);
  });
});
```
- [ ] **Step 2:** Run → FAIL. Implement `lib/billing/service-amount.ts`:
```ts
export type PricingModel = "PER_UNIT" | "PER_BUILDING" | "PER_COMMON_AREA" | "FLAT" | "METERED_PREPAID";
export type BillableService = { id: string; name: string; pricingModel: PricingModel; price: number };
export type PropertyCounts = { units: number; buildings: number; commonAreas: number };

const round2 = (n: number) => Math.round(n * 100) / 100;
export function serviceLineAmount(s: BillableService, c: PropertyCounts): number {
  switch (s.pricingModel) {
    case "PER_UNIT": return round2(s.price * c.units);
    case "PER_BUILDING": return round2(s.price * c.buildings);
    case "PER_COMMON_AREA": return round2(s.price * c.commonAreas);
    case "FLAT": return round2(s.price);
    case "METERED_PREPAID": return 0;
  }
}
export function computePackageTotal(services: BillableService[], c: PropertyCounts) {
  const lines = services.map((s) => {
    const qty = s.pricingModel === "PER_UNIT" ? c.units : s.pricingModel === "PER_BUILDING" ? c.buildings : s.pricingModel === "PER_COMMON_AREA" ? c.commonAreas : s.pricingModel === "FLAT" ? 1 : 0;
    return { serviceId: s.id, name: s.name, pricingModel: s.pricingModel, unitPrice: s.price, qty, amount: serviceLineAmount(s, c) };
  });
  const total = lines.reduce((t, l) => t + l.amount, 0);
  return { lines, totalCents: Math.round(total * 100), total: round2(total) };
}
```
- [ ] **Step 3:** Run → PASS. Append `getPropertyPackage(propertyId)` to the same file (DB): load `property.buildings { _count: { units, commonAreas } }` → counts; company services (active) + `propertyService` active flags; return `{ counts, services: [{ ...service, enabled }], enabled: BillableService[], total, totalCents }`. Commit `feat(billing): service package amount calculator`.

---

### Task 2: Access relax + package actions

**Files:** `app/actions/property-package.ts`.

- [ ] **Step 1:** Replace `requireSuperAdmin()` with `requirePropertyAccess(propertyId)` = throw unless `canManagePropertyViva(session.user.id, propertyId)`. Apply to `setPropertyService` + `addPrepaidMinutes`. Add `revalidatePath('/building/${b.id}')` for the property's buildings.
- [ ] **Step 2:** Add `listPropertyPackage(propertyId)` (guarded) → `getPropertyPackage` + the current-period `ServiceInvoice` status (`db.serviceInvoice.findUnique({ where: { customerId_period } })`). Return package + `invoice: { status, paidAt } | null` + `period`.
- [ ] **Step 3:** tsc filtered empty. Commit `feat(billing): manager/admin package selection access + loader`.

---

### Task 3: Pay intent + verified callback

**Files:** Create `app/api/property/package/pay/route.ts`, `app/api/property/package/callback/route.ts`; add `getVivaTransactionFor` to `lib/viva.ts`.

- [ ] **Step 1:** `lib/viva.ts`: `getVivaTransactionFor(cfg, transactionId)` — like `getVivaTransaction` but token via `getAccessTokenFor(cfg)`.
- [ ] **Step 2:** Pay route: `POST { propertyId }`; guard `canManagePropertyViva`; `const cfg = await getProviderVivaConfig(); if (!cfg) 503`; load property + customerId; `const pkg = await getPropertyPackage(propertyId)`; `amountCents = pkg.totalCents`; if 0 → 400 `nothing_due`; period `YYYY-MM`; upsert `ServiceInvoice` (customerId+period) PENDING with amount + lines (create `ServiceInvoiceLine` rows from `pkg.lines`); if the existing invoice is PAID → 400 `already_paid`. `merchantTrns = pkg:${propertyId}:${customerId}:${period}`; `createVivaOrderFor(cfg, { amountCents, customerTrns, merchantTrns })` → `{ checkoutUrl }`; errors 502.
- [ ] **Step 3:** Callback: GET handshake (provider creds, mirror wallet). POST: parse `pkg:` merchantTrns → propertyId/customerId/period + TransactionId; `const cfg = await getProviderVivaConfig(); if(!cfg) 200 ignored`; `const tx = await getVivaTransactionFor(cfg, TransactionId)`; require success status + merchantTrns match + `tx.amount` cents ≈ the invoice amount (re-read the ServiceInvoice); mark PAID (`status:"PAID"`, `paidAt`, `vivaOrderRef: TransactionId`) idempotent (skip if already PAID); never 500. `revalidatePath` the property + buildings.
- [ ] **Step 4:** tsc filtered empty; `npm run build`; `npx vitest run`. Commit `feat(billing): property package Viva payment + verified callback (provider account)`.

---

### Task 4: UI — «Ρυθμίσεις → Πακέτα»

**Files:** Create `components/property/PropertyPackages.tsx`; modify `components/building/manager-shell/sections.ts` (add `packages` tab to the `settings` section) + `BuildingManagerShell.tsx` (route `settings/packages`); modify the super-admin property page to add a Packages card.

- [ ] **Step 1:** `PropertyPackages` (client): props `{ propertyId, providerConfigured }` (page passes `isProviderVivaConfigured()`). On mount `listPropertyPackage`. Render service list: name · pricing label · qty×unitPrice · line amount · toggle (calls `setPropertyService` → refetch). Monthly total row. Current-period invoice status chip. «Πληρωμή πακέτου {total}» button → POST `/api/property/package/pay` → `window.location = checkoutUrl`; disabled with «Το Viva του παρόχου δεν έχει ρυθμιστεί» when `!providerConfigured`, and «Εξοφλημένο» when the period invoice is PAID. Orithon tokens, Ri Line, tabular-nums.
- [ ] **Step 2:** sections.ts: add `{ key: "packages", label: "Πακέτα" }` to the `settings` section tabs (after `viva`). BuildingManagerShell: route `settings/packages` → `<PropertyPackages propertyId={building.propertyId} providerConfigured={…} />` (thread `providerConfigured` from the page/data, or fetch in the component via a tiny server action `providerVivaConfigured()`; simplest: the page computes it and passes through the shell props — else default true and let the route 503 handle it).
- [ ] **Step 3:** Super-admin property page: add a «Πακέτα & πληρωμή» card with `<PropertyPackages/>`.
- [ ] **Step 4:** tsc filtered empty; `npm run build`. Commit `feat(billing): package selection + payment UI in manager Ρυθμίσεις`.

---

### Task 5: Verify + review + ship

- [ ] vitest/tsc/build green modulo documented.
- [ ] Dev smoke (provider unconfigured): «Ρυθμίσεις → Πακέτα» lists services + toggles work; «Πληρωμή» disabled «Το Viva του παρόχου δεν έχει ρυθμιστεί»; `POST /api/property/package/pay` → 503.
- [ ] Live tsx: `getPropertyPackage` for a demo property returns sensible counts + total.
- [ ] Security review agent: amount server-computed (never client), provider-Viva-gated, access `canManagePropertyViva` (owner/resident Forbidden), callback verified + idempotent + invoice unique per (customer,period), correct money direction (provider collects), per-property κοινόχρηστα untouched.
- [ ] Update memory; push. Completes the 4-part Viva program.
