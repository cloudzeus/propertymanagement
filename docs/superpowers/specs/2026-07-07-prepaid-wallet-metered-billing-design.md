# Prepaid Wallet & Metered AI/API Billing — Design

**Date:** 2026-07-07
**Status:** Approved (brainstorm)

## Summary

A two-tier prepaid **electronic wallet** (in EUR) that meters and bills consumption of
AI / external-API / video-conference usage across a reseller chain:

- **Super-admin (us)** = wholesaler of the AI/API tools. Pays providers directly, sets
  a per-tool **markup #1**, and sells prepaid € credit to the Admin.
- **Admin (management company)** = buys prepaid € credit from super-admin (funds the
  **Company wallet**), then resells to their own customers with their own **markup #2**,
  as per-customer monthly € allowances.
- **Customer** = end billing target. Has a per-customer wallet funded by a monthly
  allowance plus optional one-time top-ups (Viva). Metered usage debits it.

Only **metered consumption** (AI tokens, external APIs, video-conference minutes) flows
through the wallet. The fixed monthly CORE + modules stay on the existing `ServiceInvoice`.

## Key decisions

- Wallet is always denominated in **EUR** (single balance, not per-unit credits).
- **Two wallet levels:** one Company wallet + N Customer wallets.
- **Two markups:** `APICostConfig.markupPercent` (#1, super-admin → admin, already exists)
  and `CustomerMeteredPlan.adminMarkupPercent` (#2, admin → customer, new).
- Funding: **monthly recurring allowance** (from the customer's plan) **plus** ad-hoc
  **top-ups** when depleted.
- Zero balance → metered usage is **blocked** (prepaid, no overage) until topped up.
- Ledger architecture: generic `Wallet` + append-only `WalletTransaction` (chosen over
  balance-only fields and over extending `prepaidPersonMinutes`).

## Data model

### New models

```prisma
enum WalletOwnerType { COMPANY CUSTOMER }
enum WalletStatus { ACTIVE SUSPENDED }
enum WalletTxnType { ALLOWANCE TOPUP DEBIT ADJUSTMENT RESET }

model Wallet {
  id            String          @id @default(cuid())
  ownerType     WalletOwnerType
  ownerId       String          // Company.id or Customer.id
  balanceEur    Decimal         @db.Decimal(12, 4) @default(0) // cached, reconcilable from ledger
  lowBalanceEur Decimal?        @db.Decimal(12, 4)             // alert threshold
  status        WalletStatus    @default(ACTIVE)
  transactions  WalletTransaction[]
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt

  @@unique([ownerType, ownerId])
  @@index([ownerType])
}

model WalletTransaction {  // append-only ledger
  id           String        @id @default(cuid())
  walletId     String
  wallet       Wallet        @relation(fields: [walletId], references: [id], onDelete: Cascade)
  type         WalletTxnType
  amountEur    Decimal       @db.Decimal(12, 4)   // signed: +credit / -debit
  balanceAfter Decimal       @db.Decimal(12, 4)
  description  String
  refType      String?       // 'api_usage' | 'package' | 'viva' | 'manual'
  refId        String?       // e.g. APIUsageLog.id
  createdById  String?
  createdAt    DateTime      @default(now())

  @@index([walletId])
  @@index([refType, refId])
  @@index([createdAt])
}

model CustomerMeteredPlan {  // the "package" the Admin defines per customer
  id                 String   @id @default(cuid())
  customerId         String   @unique
  customer           Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)
  monthlyAllowanceEur Decimal @db.Decimal(10, 2) @default(0) // credited each month
  rollover           Boolean  @default(false)                // default: reset, not carry over
  adminMarkupPercent Float    @default(0)                    // markup #2
  active             Boolean  @default(true)
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
}
```

### Extensions to existing models

- **`APICostConfig`** becomes the official registry of AI/API tools (super-admin CRUD).
  Add: `category String` (`ai` | `api` | `video`), `unitLabel String` (e.g. "tokens",
  "λεπτά"). `markupPercent` = markup #1. `costModel`/`basePrice`/`freeQuota`/`enabled`
  stay as-is.
- **`APIUsageLog`** add: `billedCostEur` (real × markup#1), `customerChargeEur`
  (billed × markup#2), `walletTxnCompanyId`, `walletTxnCustomerId` (links into ledger).

### Two wallet levels in single-tenant

- **1 Company wallet** (`ownerType = COMPANY`) — prepaid credit the Admin bought from
  super-admin. Debited at the **billed** price on every metered event. Credited by
  super-admin top-ups.
- **N Customer wallets** (`ownerType = CUSTOMER`) — one per Customer. Credited by the
  monthly allowance + top-ups. Debited at the **admin** price.

## Metering & enforcement engine

`lib/wallet/metering.ts`:

```
recordMeteredUsage({
  apiName, units, model?,
  customerId | buildingId,   // resolve customer, isolation-aware
  userId?, assemblyId?
}): Promise<{ blocked: boolean, reason?, billedCostEur, customerChargeEur }>
```

Flow (single Prisma `$transaction` for the commit):

1. **Pricing** — `APICostConfig(apiName)`: `realCost = max(0, units − freeQuota) × basePrice`;
   `billed = realCost × (1 + markupPercent#1)`; resolve `CustomerMeteredPlan` →
   `customerCharge = billed × (1 + adminMarkupPercent#2)`.
2. **Isolation guard** — resolve `customerId` from building per the data-isolation model;
   never cross-customer.
3. **Balance check (pre-flight, before the provider call):**
   - Customer wallet `balanceEur ≥ customerCharge`, else `blocked` — action not executed,
     UI shows "buy more units".
   - Company wallet `balanceEur ≥ billed`, else `blocked` + **critical alert** to super-admin.
4. **Dual-debit (commit, after a successful provider call, with real units):**
   `WalletTransaction` DEBIT on Company (−billed) + DEBIT on Customer (−customerCharge),
   update `balanceAfter`, write `APIUsageLog` with links. Atomic.
5. **Low-balance alert** — if post-debit balance `< lowBalanceEur`, create a notification.

Two checkpoints: **pre-flight** before calling the provider (so we don't spend money for a
blocked customer) + **commit** after the successful call with actual units.

### Video / assemblies

Video-conference becomes just another `apiName` (category `video`, unit = minutes) routed
through the wallet. The legacy `PropertyService.prepaidPersonMinutes` stays for backward
compatibility; the **new** metered flow uses the wallet. Full unification/deprecation is
out of scope for now.

### Monthly allowance job

`lib/wallet/monthly-allowance.ts` (cron/trigger): for each active `CustomerMeteredPlan` —
if `rollover = false`, RESET the wallet then ALLOWANCE-credit `monthlyAllowanceEur`;
if `rollover = true`, add on top.

## UI surfaces

**Super-admin (wholesaler):**
1. **AI Tools & APIs** — replaces the static `/super-admin/ai-tools` page with real CRUD
   over `APICostConfig` (displayName, apiName, category, costModel, basePrice, unitLabel,
   freeQuota, markupPercent#1, enabled, docs). DataTable standard + drawer form.
2. **Company Wallet** (under `super-admin/billing`) — wholesale credit balance, "Credit"
   button (record Admin's €X purchase), ledger, low-balance threshold, usage chart.

**Admin (reseller):**
3. **Πακέτα Χρεώσεων / Metered Plans** — create & assign `CustomerMeteredPlan` per customer
   (monthlyAllowanceEur, rollover, adminMarkupPercent#2). DataTable of customers + plans.
4. **Customer wallets overview** — list of Customer wallets, balances, low balances in red,
   manual credit/adjustment button.

**Customer / portal:**
5. **My Wallet** — € balance, monthly allowance, ledger history, and "Buy extra units +€10"
   → Viva checkout (one-time top-up, reuses existing Viva integration). At zero: banner
   "AI units depleted, buy to continue".

**API routes:** `super-admin/ai-tools` (CRUD), `super-admin/wallet` (company + top-up),
`admin/metered-plans` (CRUD), `admin/customer-wallets`, `wallet/me`, `wallet/topup` (Viva).

All new routes guarded by `requirePermission` per the existing dynamic RBAC.

## Implementation phases

1. Schema migration + ledger core (`Wallet`/`WalletTransaction`/`CustomerMeteredPlan`) +
   metering engine (`lib/wallet/*`).
2. Super-admin AI Tools CRUD + Company wallet UI/API.
3. Admin metered-plans + customer-wallets overview UI/API.
4. Customer portal wallet + Viva top-up + monthly allowance job.

## Out of scope

- Full deprecation of `prepaidPersonMinutes` (kept for backward compatibility).
- Putting the fixed monthly CORE/modules through the wallet (stays on `ServiceInvoice`).
- Per-unit (non-EUR) credit balances.
```
