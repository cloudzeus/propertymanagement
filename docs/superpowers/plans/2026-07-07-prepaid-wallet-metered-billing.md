# Prepaid Wallet & Metered AI/API Billing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a two-tier prepaid EUR wallet that meters AI/API/video consumption, dual-debits a Company wallet (at billed price) and a Customer wallet (at admin price), and blocks metered usage when a wallet is empty.

**Architecture:** A generic `Wallet` + append-only `WalletTransaction` ledger. Pure pricing helpers compute real → billed (markup#1) → customer-charge (markup#2). A `recordMeteredUsage()` orchestrator does a pre-flight balance check before the provider call and an atomic dual-debit commit after. A monthly job credits each customer's allowance. UI is added in super-admin (tool CRUD + company wallet), admin (metered plans + customer wallets), and the customer portal (wallet + Viva top-up).

**Tech Stack:** Next.js 16.2 (App Router), Prisma 7 / PostgreSQL, TypeScript, Vitest, existing `@/lib/db`, `@/lib/api-costs`, `requirePermission` (RBAC), existing DataTable + Viva flow.

**Spec:** `docs/superpowers/specs/2026-07-07-prepaid-wallet-metered-billing-design.md`

**Prisma migration note:** This repo does NOT use `prisma migrate dev` (causes drift → reset). To generate a migration after editing `prisma/schema.prisma`:
```bash
npx prisma migrate diff \
  --from-config-datasource prisma.config.ts \
  --to-schema prisma/schema.prisma \
  --script > prisma/migrations/<timestamp>_<name>/migration.sql
# then:
npx prisma generate
npx prisma migrate deploy
```
Regenerate the client (`npx prisma generate`) after every schema change so `db.wallet` / `db.walletTransaction` / `db.customerMeteredPlan` typings exist.

---

## Phase 1 — Schema, ledger core, metering engine

### Task 1: Prisma schema — wallet models

**Files:**
- Modify: `prisma/schema.prisma` (append new models near the `APICostConfig` block, ~line 1455)

- [ ] **Step 1: Add enums and models to `prisma/schema.prisma`**

Append:

```prisma
enum WalletOwnerType {
  COMPANY
  CUSTOMER
}

enum WalletStatus {
  ACTIVE
  SUSPENDED
}

enum WalletTxnType {
  ALLOWANCE
  TOPUP
  DEBIT
  ADJUSTMENT
  RESET
}

model Wallet {
  id            String              @id @default(cuid())
  ownerType     WalletOwnerType
  ownerId       String
  balanceEur    Decimal             @default(0) @db.Decimal(12, 4)
  lowBalanceEur Decimal?            @db.Decimal(12, 4)
  status        WalletStatus        @default(ACTIVE)
  transactions  WalletTransaction[]
  createdAt     DateTime            @default(now())
  updatedAt     DateTime            @updatedAt

  @@unique([ownerType, ownerId])
  @@index([ownerType])
}

model WalletTransaction {
  id           String        @id @default(cuid())
  walletId     String
  wallet       Wallet        @relation(fields: [walletId], references: [id], onDelete: Cascade)
  type         WalletTxnType
  amountEur    Decimal       @db.Decimal(12, 4)
  balanceAfter Decimal       @db.Decimal(12, 4)
  description  String
  refType      String?
  refId        String?
  createdById  String?
  createdAt    DateTime      @default(now())

  @@index([walletId])
  @@index([refType, refId])
  @@index([createdAt])
}

model CustomerMeteredPlan {
  id                  String   @id @default(cuid())
  customerId          String   @unique
  customer            Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)
  monthlyAllowanceEur Decimal  @default(0) @db.Decimal(10, 2)
  rollover            Boolean  @default(false)
  adminMarkupPercent  Float    @default(0)
  active              Boolean  @default(true)
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
}
```

- [ ] **Step 2: Add the back-relation to `Customer`**

Find the `Customer` model and add inside it:

```prisma
  meteredPlan  CustomerMeteredPlan?
```

- [ ] **Step 3: Extend `APICostConfig` (add `category`, `unitLabel`)**

In the `APICostConfig` model, after `documentationUrl`, add:

```prisma
  category              String   @default("api") // 'ai' | 'api' | 'video'
  unitLabel             String   @default("units") // e.g. "tokens", "λεπτά", "emails"
```

- [ ] **Step 4: Extend `APIUsageLog` (billed/customer charge + ledger links)**

In the `APIUsageLog` model, after `currency`, add:

```prisma
  billedCostEur         Float?   // real × (1 + markup#1)
  customerChargeEur     Float?   // billed × (1 + markup#2)
  walletTxnCompanyId    String?  // WalletTransaction.id for the company debit
  walletTxnCustomerId   String?  // WalletTransaction.id for the customer debit
```

- [ ] **Step 5: Generate migration + client**

Run:
```bash
mkdir -p prisma/migrations/20260707000000_prepaid_wallet
npx prisma migrate diff --from-config-datasource prisma.config.ts --to-schema prisma/schema.prisma --script > prisma/migrations/20260707000000_prepaid_wallet/migration.sql
npx prisma generate
```
Expected: `migration.sql` contains `CREATE TABLE "Wallet"`, `"WalletTransaction"`, `"CustomerMeteredPlan"`, and `ALTER TABLE "APICostConfig"`/`"APIUsageLog"`. `prisma generate` succeeds.

- [ ] **Step 6: Apply migration**

Run: `npx prisma migrate deploy`
Expected: migration applied, no errors.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(wallet): add Wallet, WalletTransaction, CustomerMeteredPlan schema"
```

---

### Task 2: Pricing helpers (pure, TDD)

**Files:**
- Create: `lib/wallet/pricing.ts`
- Test: `lib/wallet/pricing.test.ts`

- [ ] **Step 1: Write failing tests**

`lib/wallet/pricing.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeRealCost, computeCharges } from "./pricing";

describe("computeRealCost", () => {
  it("per_token uses tokens/1000 × basePrice", () => {
    expect(computeRealCost({ costModel: "per_token", basePrice: 0.001, freeQuota: 0 }, { tokensUsed: 15000 })).toBeCloseTo(0.015, 9);
  });
  it("per_minute uses minutes × basePrice", () => {
    expect(computeRealCost({ costModel: "per_minute", basePrice: 0.05, freeQuota: 0 }, { minutes: 30 })).toBeCloseTo(1.5, 9);
  });
  it("per_gb subtracts free quota", () => {
    const gb2 = 2 * 1024 * 1024 * 1024;
    expect(computeRealCost({ costModel: "per_gb", basePrice: 0.01, freeQuota: 1 }, { bytesProcessed: gb2 })).toBeCloseTo(0.01, 9);
  });
  it("per_request/per_email uses requestCount × basePrice", () => {
    expect(computeRealCost({ costModel: "per_email", basePrice: 0.002, freeQuota: 0 }, { requestCount: 5 })).toBeCloseTo(0.01, 9);
  });
});

describe("computeCharges", () => {
  it("applies markup#1 for billed and markup#2 for customer charge", () => {
    const r = computeCharges(1.0, 20, 50); // real=1, +20% => billed 1.2, +50% => 1.8
    expect(r.billedCostEur).toBeCloseTo(1.2, 9);
    expect(r.customerChargeEur).toBeCloseTo(1.8, 9);
  });
  it("zero markups pass through", () => {
    const r = computeCharges(2.0, 0, 0);
    expect(r.billedCostEur).toBe(2);
    expect(r.customerChargeEur).toBe(2);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run lib/wallet/pricing.test.ts`
Expected: FAIL ("computeRealCost is not a function").

- [ ] **Step 3: Implement `lib/wallet/pricing.ts`**

```ts
import { getBilledCost } from "@/lib/api-costs";

export interface PricingConfig {
  costModel: string; // 'per_token' | 'per_minute' | 'per_gb' | 'per_request' | 'per_email'
  basePrice: number;
  freeQuota: number;
}

export interface UsageUnits {
  tokensUsed?: number;
  minutes?: number;
  bytesProcessed?: number;
  requestCount?: number;
}

/** Real provider cost in EUR, matching the semantics used in lib/api-costs.logAPIUsage. */
export function computeRealCost(config: PricingConfig, units: UsageUnits): number {
  const free = config.freeQuota || 0;
  switch (config.costModel) {
    case "per_token":
      return ((units.tokensUsed || 0) / 1000) * config.basePrice;
    case "per_minute":
      return (units.minutes || 0) * config.basePrice;
    case "per_gb": {
      const gb = (units.bytesProcessed || 0) / (1024 * 1024 * 1024);
      return Math.max(0, gb - free) * config.basePrice;
    }
    case "per_request":
    case "per_email":
    default:
      return (units.requestCount || 1) * config.basePrice;
  }
}

/** billed = real × (1 + markup#1); customerCharge = billed × (1 + markup#2). */
export function computeCharges(realCost: number, markup1Percent: number, markup2Percent: number) {
  const billedCostEur = getBilledCost(realCost, markup1Percent);
  const customerChargeEur = getBilledCost(billedCostEur, markup2Percent);
  return { realCost, billedCostEur, customerChargeEur };
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run lib/wallet/pricing.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/wallet/pricing.ts lib/wallet/pricing.test.ts
git commit -m "feat(wallet): pure pricing helpers (real/billed/customer charge)"
```

---

### Task 3: Ledger helpers (get-or-create, credit, debit)

**Files:**
- Create: `lib/wallet/ledger.ts`
- Test: `lib/wallet/ledger.test.ts`

- [ ] **Step 1: Write failing test (mocked db)**

`lib/wallet/ledger.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const wallet = { id: "w1", ownerType: "CUSTOMER", ownerId: "c1", balanceEur: 10, lowBalanceEur: 2, status: "ACTIVE" };
const tx = {
  wallet: {
    findUnique: vi.fn(),
    upsert: vi.fn(async ({ create }: any) => ({ ...wallet, ...create })),
    update: vi.fn(async ({ data }: any) => ({ ...wallet, balanceEur: data.balanceEur })),
  },
  walletTransaction: { create: vi.fn(async ({ data }: any) => ({ id: "t1", ...data })) },
};
vi.mock("@/lib/db", () => ({
  db: {
    wallet: { findUnique: vi.fn(async () => wallet) },
    $transaction: vi.fn(async (fn: any) => fn(tx)),
  },
}));

import { applyLedgerEntry } from "./ledger";

beforeEach(() => vi.clearAllMocks());

describe("applyLedgerEntry", () => {
  it("debits and records balanceAfter", async () => {
    tx.wallet.findUnique.mockResolvedValue(wallet);
    const res = await applyLedgerEntry(tx as any, {
      ownerType: "CUSTOMER", ownerId: "c1", type: "DEBIT", amountEur: -3, description: "ai",
    });
    expect(res.balanceAfter).toBeCloseTo(7, 9);
    expect(tx.walletTransaction.create).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run lib/wallet/ledger.test.ts`
Expected: FAIL ("applyLedgerEntry is not a function").

- [ ] **Step 3: Implement `lib/wallet/ledger.ts`**

```ts
import { db } from "@/lib/db";
import type { WalletOwnerType, WalletStatus, WalletTxnType } from "@/lib/prisma/enums";

type TxClient = Parameters<Parameters<typeof db.$transaction>[0]>[0];

export interface LedgerEntryInput {
  ownerType: WalletOwnerType;
  ownerId: string;
  type: WalletTxnType;
  amountEur: number; // signed: +credit / -debit
  description: string;
  refType?: string;
  refId?: string;
  createdById?: string;
}

/** Read a wallet's balance (0 if it does not exist yet). */
export async function getWalletBalance(ownerType: WalletOwnerType, ownerId: string): Promise<number> {
  const w = await db.wallet.findUnique({ where: { ownerType_ownerId: { ownerType, ownerId } } });
  return w ? Number(w.balanceEur) : 0;
}

/** Apply one ledger entry inside an existing transaction; upserts the wallet, updates cached balance, writes the txn row. */
export async function applyLedgerEntry(tx: TxClient, input: LedgerEntryInput) {
  const wallet = await tx.wallet.upsert({
    where: { ownerType_ownerId: { ownerType: input.ownerType, ownerId: input.ownerId } },
    create: { ownerType: input.ownerType, ownerId: input.ownerId, balanceEur: 0 },
    update: {},
  });
  const balanceAfter = Number(wallet.balanceEur) + input.amountEur;
  await tx.wallet.update({
    where: { id: wallet.id },
    data: { balanceEur: balanceAfter },
  });
  const txn = await tx.walletTransaction.create({
    data: {
      walletId: wallet.id,
      type: input.type,
      amountEur: input.amountEur,
      balanceAfter,
      description: input.description,
      refType: input.refType,
      refId: input.refId,
      createdById: input.createdById,
    },
  });
  return { walletId: wallet.id, txnId: txn.id, balanceAfter, lowBalanceEur: wallet.lowBalanceEur ? Number(wallet.lowBalanceEur) : null };
}

/** Convenience: credit a wallet in its own transaction (top-up, allowance, manual adjustment). */
export async function creditWallet(input: Omit<LedgerEntryInput, "amountEur"> & { amountEur: number }) {
  return db.$transaction((tx) => applyLedgerEntry(tx as TxClient, input));
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run lib/wallet/ledger.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/wallet/ledger.ts lib/wallet/ledger.test.ts
git commit -m "feat(wallet): ledger helpers (balance read, atomic entry, credit)"
```

---

### Task 4: Customer resolution (isolation-aware)

**Files:**
- Create: `lib/wallet/resolve-customer.ts`
- Test: `lib/wallet/resolve-customer.test.ts`

- [ ] **Step 1: Write failing test (mocked db)**

`lib/wallet/resolve-customer.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({
  db: { building: { findUnique: vi.fn() } },
}));
import { db } from "@/lib/db";
import { resolveCustomerId } from "./resolve-customer";

beforeEach(() => vi.clearAllMocks());

describe("resolveCustomerId", () => {
  it("returns explicit customerId directly", async () => {
    expect(await resolveCustomerId({ customerId: "c1" })).toBe("c1");
  });
  it("resolves customerId from a building's property", async () => {
    (db.building.findUnique as any).mockResolvedValue({ property: { customerId: "c9" } });
    expect(await resolveCustomerId({ buildingId: "b1" })).toBe("c9");
  });
  it("returns null when nothing resolves", async () => {
    (db.building.findUnique as any).mockResolvedValue(null);
    expect(await resolveCustomerId({ buildingId: "bX" })).toBeNull();
  });
});
```

> Before implementing, verify the relation path: open `prisma/schema.prisma` and confirm `Building` has a `property` relation and `Property` has `customerId`. If the field names differ, adjust the `include`/access below to match the real schema.

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run lib/wallet/resolve-customer.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `lib/wallet/resolve-customer.ts`**

```ts
import { db } from "@/lib/db";

export interface CustomerRef {
  customerId?: string;
  buildingId?: string;
}

/** Resolve the owning Customer for a metered event. Never crosses customers — returns null if unresolved. */
export async function resolveCustomerId(ref: CustomerRef): Promise<string | null> {
  if (ref.customerId) return ref.customerId;
  if (ref.buildingId) {
    const b = await db.building.findUnique({
      where: { id: ref.buildingId },
      include: { property: { select: { customerId: true } } },
    });
    return b?.property?.customerId ?? null;
  }
  return null;
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run lib/wallet/resolve-customer.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/wallet/resolve-customer.ts lib/wallet/resolve-customer.test.ts
git commit -m "feat(wallet): isolation-aware customer resolution"
```

---

### Task 5: Metering orchestrator (pre-flight + dual-debit commit)

**Files:**
- Create: `lib/wallet/metering.ts`
- Test: `lib/wallet/metering.test.ts`
- Note: reads the single Company wallet by `ownerId = "SYSTEM"` (single-tenant install has one company wallet keyed by the constant below).

- [ ] **Step 1: Write failing test (mocked deps)**

`lib/wallet/metering.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api-costs", async (orig) => ({
  ...(await orig<any>()),
  getConfig: vi.fn(),
}));
vi.mock("./resolve-customer", () => ({ resolveCustomerId: vi.fn(async () => "c1") }));

const balances: Record<string, number> = {};
vi.mock("@/lib/db", () => ({
  db: {
    customerMeteredPlan: { findUnique: vi.fn(async () => ({ adminMarkupPercent: 50, active: true })) },
    wallet: { findUnique: vi.fn(async ({ where }: any) => ({ id: where.ownerType_ownerId.ownerId, balanceEur: balances[where.ownerType_ownerId.ownerId] ?? 0, lowBalanceEur: null })) },
    $transaction: vi.fn(async (fn: any) => fn({
      wallet: {
        upsert: vi.fn(async ({ where }: any) => ({ id: where.ownerType_ownerId.ownerId, balanceEur: balances[where.ownerType_ownerId.ownerId] ?? 0, lowBalanceEur: null })),
        update: vi.fn(async ({ where, data }: any) => { balances[where.id] = data.balanceEur; return {}; }),
      },
      walletTransaction: { create: vi.fn(async ({ data }: any) => ({ id: "t-" + data.walletId, ...data })) },
      aPIUsageLog: { create: vi.fn(async ({ data }: any) => ({ id: "log1", ...data })) },
    })),
  },
}));

import { getConfig } from "@/lib/api-costs";
import { recordMeteredUsage } from "./metering";

beforeEach(() => {
  vi.clearAllMocks();
  balances["SYSTEM"] = 100;
  balances["c1"] = 5;
  (getConfig as any).mockResolvedValue({ apiName: "deepseek", costModel: "per_token", basePrice: 0.001, freeQuota: 0, markupPercent: 20 });
});

describe("recordMeteredUsage", () => {
  it("blocks when the customer wallet cannot cover the charge", async () => {
    balances["c1"] = 0.0001;
    const r = await recordMeteredUsage({ apiName: "deepseek", tokensUsed: 100000, buildingId: "b1" });
    expect(r.blocked).toBe(true);
    expect(r.reason).toBe("customer_insufficient");
  });

  it("dual-debits company (billed) and customer (charge) when funded", async () => {
    // real = 100000/1000 * 0.001 = 0.1 ; billed = 0.12 ; customer = 0.18
    const r = await recordMeteredUsage({ apiName: "deepseek", tokensUsed: 100000, buildingId: "b1" });
    expect(r.blocked).toBe(false);
    expect(r.billedCostEur).toBeCloseTo(0.12, 6);
    expect(r.customerChargeEur).toBeCloseTo(0.18, 6);
    expect(balances["SYSTEM"]).toBeCloseTo(100 - 0.12, 6);
    expect(balances["c1"]).toBeCloseTo(5 - 0.18, 6);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run lib/wallet/metering.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `lib/wallet/metering.ts`**

```ts
import { db } from "@/lib/db";
import { getConfig } from "@/lib/api-costs";
import { computeRealCost, computeCharges } from "./pricing";
import { applyLedgerEntry } from "./ledger";
import { resolveCustomerId } from "./resolve-customer";

/** Single-tenant company wallet key. */
export const COMPANY_WALLET_ID = "SYSTEM";

export interface MeteredUsageInput {
  apiName: string;
  model?: string;
  endpoint?: string;
  tokensUsed?: number;
  minutes?: number;
  bytesProcessed?: number;
  requestCount?: number;
  customerId?: string;
  buildingId?: string;
  userId?: string;
  assemblyId?: string;
}

export interface MeteredUsageResult {
  blocked: boolean;
  reason?: "customer_insufficient" | "company_insufficient" | "no_customer" | "unknown_api" | "no_charge";
  billedCostEur: number;
  customerChargeEur: number;
  logId?: string;
}

async function balanceOf(ownerType: "COMPANY" | "CUSTOMER", ownerId: string): Promise<number> {
  const w = await db.wallet.findUnique({ where: { ownerType_ownerId: { ownerType, ownerId } } });
  return w ? Number(w.balanceEur) : 0;
}

/**
 * Meter one consumption event. Call the PROVIDER FIRST for success, then call this with real units;
 * or call in "preflight" style before the provider by passing estimated units and checking `blocked`.
 */
export async function recordMeteredUsage(input: MeteredUsageInput): Promise<MeteredUsageResult> {
  const config = await getConfig(input.apiName);
  if (!config) return { blocked: true, reason: "unknown_api", billedCostEur: 0, customerChargeEur: 0 };

  const customerId = await resolveCustomerId({ customerId: input.customerId, buildingId: input.buildingId });
  if (!customerId) return { blocked: true, reason: "no_customer", billedCostEur: 0, customerChargeEur: 0 };

  const plan = await db.customerMeteredPlan.findUnique({ where: { customerId } });
  const markup2 = plan?.active ? plan.adminMarkupPercent : 0;

  const realCost = computeRealCost(
    { costModel: config.costModel, basePrice: config.basePrice, freeQuota: config.freeQuota },
    { tokensUsed: input.tokensUsed, minutes: input.minutes, bytesProcessed: input.bytesProcessed, requestCount: input.requestCount },
  );
  const { billedCostEur, customerChargeEur } = computeCharges(realCost, config.markupPercent, markup2);

  if (billedCostEur <= 0 && customerChargeEur <= 0) {
    return { blocked: false, reason: "no_charge", billedCostEur: 0, customerChargeEur: 0 };
  }

  // Pre-flight balance checks.
  const [companyBal, customerBal] = await Promise.all([
    balanceOf("COMPANY", COMPANY_WALLET_ID),
    balanceOf("CUSTOMER", customerId),
  ]);
  if (customerBal < customerChargeEur) {
    return { blocked: true, reason: "customer_insufficient", billedCostEur, customerChargeEur };
  }
  if (companyBal < billedCostEur) {
    // TODO-alert handled by caller/notifications; block to avoid burning provider spend.
    return { blocked: true, reason: "company_insufficient", billedCostEur, customerChargeEur };
  }

  // Atomic dual-debit + usage log.
  const result = await db.$transaction(async (tx) => {
    const companyTxn = await applyLedgerEntry(tx as any, {
      ownerType: "COMPANY", ownerId: COMPANY_WALLET_ID, type: "DEBIT",
      amountEur: -billedCostEur, description: `${config.displayName ?? input.apiName} usage`,
      refType: "api_usage", refId: input.apiName,
    });
    const customerTxn = await applyLedgerEntry(tx as any, {
      ownerType: "CUSTOMER", ownerId: customerId, type: "DEBIT",
      amountEur: -customerChargeEur, description: `${config.displayName ?? input.apiName} usage`,
      refType: "api_usage", refId: input.apiName,
    });
    const log = await tx.aPIUsageLog.create({
      data: {
        apiName: input.apiName,
        endpoint: input.endpoint,
        model: input.model,
        requestCount: input.requestCount ?? 1,
        tokensUsed: input.tokensUsed,
        bytesProcessed: input.bytesProcessed,
        costPerUnit: config.basePrice,
        totalCost: Number(realCost.toFixed(6)),
        billedCostEur: Number(billedCostEur.toFixed(6)),
        customerChargeEur: Number(customerChargeEur.toFixed(6)),
        walletTxnCompanyId: companyTxn.txnId,
        walletTxnCustomerId: customerTxn.txnId,
        customerId,
        buildingId: input.buildingId,
        userId: input.userId,
        assemblyId: input.assemblyId,
        status: "SUCCESS",
      },
    });
    return { logId: log.id };
  });

  return { blocked: false, billedCostEur, customerChargeEur, logId: result.logId };
}
```

> Note: `getConfig` in `lib/api-costs.ts` returns a config object including `markupPercent` and `displayName`; verify it exposes `markupPercent` (it merges from `APICostConfig`). If `getConfig` does not include `markupPercent`, extend it to select that column.

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run lib/wallet/metering.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/wallet/metering.ts lib/wallet/metering.test.ts
git commit -m "feat(wallet): metering orchestrator with pre-flight and dual-debit"
```

---

### Task 6: Monthly allowance job

**Files:**
- Create: `lib/wallet/allowance.ts`
- Test: `lib/wallet/allowance.test.ts`

- [ ] **Step 1: Write failing test (mocked db)**

`lib/wallet/allowance.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
const calls: any[] = [];
vi.mock("@/lib/db", () => ({
  db: {
    customerMeteredPlan: { findMany: vi.fn(async () => [
      { customerId: "c1", monthlyAllowanceEur: 10, rollover: false },
      { customerId: "c2", monthlyAllowanceEur: 5, rollover: true },
    ]) },
  },
}));
vi.mock("./ledger", () => ({
  creditWallet: vi.fn(async (i: any) => { calls.push(i); return { balanceAfter: i.amountEur }; }),
  applyLedgerEntry: vi.fn(),
  getWalletBalance: vi.fn(async () => 3),
}));
import { runMonthlyAllowance } from "./allowance";
import { getWalletBalance } from "./ledger";

beforeEach(() => { calls.length = 0; vi.clearAllMocks(); (getWalletBalance as any).mockResolvedValue(3); });

describe("runMonthlyAllowance", () => {
  it("resets non-rollover wallets to exactly the allowance", async () => {
    await runMonthlyAllowance();
    const c1 = calls.find((c) => c.ownerId === "c1");
    expect(c1.type).toBe("RESET");
    expect(c1.amountEur).toBeCloseTo(10 - 3, 9); // brings 3 → 10
  });
  it("adds allowance on top for rollover wallets", async () => {
    await runMonthlyAllowance();
    const c2 = calls.find((c) => c.ownerId === "c2");
    expect(c2.type).toBe("ALLOWANCE");
    expect(c2.amountEur).toBeCloseTo(5, 9);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run lib/wallet/allowance.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `lib/wallet/allowance.ts`**

```ts
import { db } from "@/lib/db";
import { creditWallet, getWalletBalance } from "./ledger";

/** Credit each active customer plan's monthly allowance. Non-rollover wallets are reset to exactly the allowance. */
export async function runMonthlyAllowance(): Promise<{ processed: number }> {
  const plans = await db.customerMeteredPlan.findMany({ where: { active: true } });
  let processed = 0;
  for (const plan of plans) {
    const allowance = Number(plan.monthlyAllowanceEur);
    if (allowance <= 0) continue;
    if (plan.rollover) {
      await creditWallet({
        ownerType: "CUSTOMER", ownerId: plan.customerId, type: "ALLOWANCE",
        amountEur: allowance, description: "Monthly allowance (rollover)",
        refType: "package",
      });
    } else {
      const current = await getWalletBalance("CUSTOMER", plan.customerId);
      const delta = allowance - current; // reset to exactly the allowance
      await creditWallet({
        ownerType: "CUSTOMER", ownerId: plan.customerId, type: "RESET",
        amountEur: delta, description: "Monthly allowance (reset)",
        refType: "package",
      });
    }
    processed++;
  }
  return { processed };
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run lib/wallet/allowance.test.ts`
Expected: PASS.

- [ ] **Step 5: Add a trigger route so the job can be run by cron**

Create `app/api/cron/monthly-allowance/route.ts`:

```ts
import { runMonthlyAllowance } from "@/lib/wallet/allowance";

export async function POST(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  const result = await runMonthlyAllowance();
  return new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json" } });
}
```

- [ ] **Step 6: Commit**

```bash
git add lib/wallet/allowance.ts lib/wallet/allowance.test.ts app/api/cron/monthly-allowance/route.ts
git commit -m "feat(wallet): monthly allowance job + cron trigger route"
```

---

### Task 7: Wire metering into existing usage callers

**Files:**
- Modify: `lib/ai.ts` (the `logAPIUsage` call sites, ~lines 50, 67, 125, 142)

- [ ] **Step 1: Read the current call sites**

Run: `grep -n "logAPIUsage" lib/ai.ts`
Confirm each call passes `apiName`, `tokensUsed`, and a `buildingId`/`customerId` when available.

- [ ] **Step 2: Add a metering call alongside logging where a customer context exists**

In `lib/ai.ts`, for each successful AI completion that has `buildingId` or `customerId` in scope, add after the existing `logAPIUsage(...)`:

```ts
import { recordMeteredUsage } from "@/lib/wallet/metering";

// after a successful completion with token usage + customer context:
await recordMeteredUsage({
  apiName: "deepseek",
  model,
  tokensUsed,
  buildingId,   // or customerId, whichever is in scope
  userId,
});
```

> Where a call site has no customer context (system-level usage), leave it logging-only (do not meter). `recordMeteredUsage` returns `{ blocked: "no_customer" }` harmlessly if called without one, but skip it to avoid noise.

- [ ] **Step 3: Enforce blocking at the entry point of user-facing AI (the AI agent API)**

Open `app/api/ai/agent/route.ts` (the AI onboarding/agent endpoint). Before calling the model, add a pre-flight check when a `buildingId`/`customerId` is present:

```ts
import { recordMeteredUsage } from "@/lib/wallet/metering";

// estimate a small floor cost to gate access (e.g. 1 request unit); or run after and block next call.
// Minimal gate: check the customer wallet balance is > 0 before proceeding.
```

Implement the minimal gate by importing `getWalletBalance` and returning HTTP 402 when depleted:

```ts
import { getWalletBalance } from "@/lib/wallet/ledger";
import { resolveCustomerId } from "@/lib/wallet/resolve-customer";

const customerId = await resolveCustomerId({ buildingId /* or customerId */ });
if (customerId && (await getWalletBalance("CUSTOMER", customerId)) <= 0) {
  return new Response(JSON.stringify({ error: "wallet_empty" }), { status: 402, headers: { "Content-Type": "application/json" } });
}
```

- [ ] **Step 4: Manual verification**

Run the app (`npm run dev`), trigger an AI action for a customer whose wallet has balance, and confirm via a DB check that a `WalletTransaction` DEBIT row was created for both COMPANY and CUSTOMER:
```bash
npx prisma studio  # inspect WalletTransaction
```
Expected: two DEBIT rows per AI call; customer wallet balance decreases.

- [ ] **Step 5: Commit**

```bash
git add lib/ai.ts app/api/ai/agent/route.ts
git commit -m "feat(wallet): meter AI usage and gate depleted customer wallets"
```

---

## Phase 2 — Super-admin: AI Tools CRUD + Company wallet

### Task 8: AI Tools CRUD API

**Files:**
- Create: `app/api/super-admin/ai-tools/route.ts` (GET list, POST create)
- Create: `app/api/super-admin/ai-tools/[apiName]/route.ts` (PUT update, DELETE)

- [ ] **Step 1: Implement list + create**

`app/api/super-admin/ai-tools/route.ts`:

```ts
import { auth } from "@/auth";
import { db } from "@/lib/db";

function forbidden() {
  return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403, headers: { "Content-Type": "application/json" } });
}
async function requireSuperAdmin() {
  const session = await auth();
  return session?.user && (session.user as any).role === "SUPER_ADMIN";
}

export async function GET() {
  if (!(await requireSuperAdmin())) return forbidden();
  const rows = await db.aPICostConfig.findMany({ orderBy: { displayName: "asc" } });
  return Response.json({ tools: rows });
}

export async function POST(request: Request) {
  if (!(await requireSuperAdmin())) return forbidden();
  const b = await request.json();
  if (!b.apiName || !b.displayName) {
    return new Response(JSON.stringify({ error: "apiName and displayName required" }), { status: 400 });
  }
  const tool = await db.aPICostConfig.create({
    data: {
      apiName: String(b.apiName),
      displayName: String(b.displayName),
      category: ["ai", "api", "video"].includes(b.category) ? b.category : "api",
      costModel: String(b.costModel || "per_request"),
      unitLabel: String(b.unitLabel || "units"),
      basePrice: Number(b.basePrice) || 0,
      freeQuota: Math.round(Number(b.freeQuota) || 0),
      markupPercent: Number(b.markupPercent) || 0,
      enabled: b.enabled !== false,
      documentationUrl: b.documentationUrl || null,
      notes: b.notes || null,
    },
  });
  return Response.json({ tool }, { status: 201 });
}
```

- [ ] **Step 2: Implement update + delete**

`app/api/super-admin/ai-tools/[apiName]/route.ts`:

```ts
import { auth } from "@/auth";
import { db } from "@/lib/db";

async function requireSuperAdmin() {
  const session = await auth();
  return session?.user && (session.user as any).role === "SUPER_ADMIN";
}
const forbidden = () => new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403 });

export async function PUT(request: Request, { params }: { params: Promise<{ apiName: string }> }) {
  if (!(await requireSuperAdmin())) return forbidden();
  const { apiName } = await params;
  const b = await request.json();
  const num = (v: unknown, f: number) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : f; };
  const tool = await db.aPICostConfig.update({
    where: { apiName },
    data: {
      displayName: b.displayName,
      category: ["ai", "api", "video"].includes(b.category) ? b.category : undefined,
      costModel: b.costModel,
      unitLabel: b.unitLabel,
      basePrice: b.basePrice !== undefined ? num(b.basePrice, 0) : undefined,
      freeQuota: b.freeQuota !== undefined ? Math.round(num(b.freeQuota, 0)) : undefined,
      markupPercent: b.markupPercent !== undefined ? num(b.markupPercent, 0) : undefined,
      enabled: typeof b.enabled === "boolean" ? b.enabled : undefined,
      documentationUrl: b.documentationUrl,
      notes: b.notes,
    },
  });
  return Response.json({ tool });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ apiName: string }> }) {
  if (!(await requireSuperAdmin())) return forbidden();
  const { apiName } = await params;
  await db.aPICostConfig.delete({ where: { apiName } });
  return Response.json({ ok: true });
}
```

- [ ] **Step 3: Manual verification**

Run `npm run dev`, then:
```bash
curl -s -X POST localhost:3000/api/super-admin/ai-tools -H 'Content-Type: application/json' -d '{"apiName":"test-tool","displayName":"Test","category":"ai","costModel":"per_token","basePrice":0.001,"markupPercent":20}' | cat
```
Expected: 201 with the created tool (must be signed in as SUPER_ADMIN; otherwise 403 — verify auth path in a browser session instead).

- [ ] **Step 4: Commit**

```bash
git add app/api/super-admin/ai-tools/
git commit -m "feat(wallet): super-admin AI tools CRUD API over APICostConfig"
```

---

### Task 9: AI Tools management UI (replace static page)

**Files:**
- Modify: `app/(company)/super-admin/ai-tools/page.tsx` (replace the static content with a real client)
- Create: `app/(company)/super-admin/ai-tools/AiToolsClient.tsx`

- [ ] **Step 1: Convert the page to render the client**

Replace the body of `app/(company)/super-admin/ai-tools/page.tsx` with:

```tsx
import AiToolsClient from "./AiToolsClient";

export default function AIToolsPage() {
  return <AiToolsClient />;
}
```

- [ ] **Step 2: Implement the client (list + add/edit form)**

Create `app/(company)/super-admin/ai-tools/AiToolsClient.tsx` modeled on the existing `app/(company)/super-admin/settings/costs/page.tsx` (same fetch/edit pattern). It must:
- `GET /api/super-admin/ai-tools` on mount, list tools in a table (displayName, apiName, category, costModel, basePrice, unitLabel, freeQuota, markupPercent, enabled).
- "Add tool" button opens a form (apiName, displayName, category select ai/api/video, costModel select, basePrice, unitLabel, freeQuota, markupPercent, documentationUrl, notes) → `POST /api/super-admin/ai-tools`.
- Inline "Edit" per row → `PUT /api/super-admin/ai-tools/{apiName}`, "Delete" → `DELETE`.

```tsx
"use client";
import { useEffect, useState } from "react";
import { RiRobot2Line, RiAddLine } from "react-icons/ri";

interface Tool {
  apiName: string; displayName: string; category: string; costModel: string;
  unitLabel: string; basePrice: number; freeQuota: number; markupPercent: number;
  enabled: boolean; documentationUrl?: string | null; notes?: string | null;
}
const EMPTY: Tool = { apiName: "", displayName: "", category: "ai", costModel: "per_token", unitLabel: "tokens", basePrice: 0, freeQuota: 0, markupPercent: 0, enabled: true };

export default function AiToolsClient() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [draft, setDraft] = useState<Tool | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/super-admin/ai-tools");
    if (res.ok) setTools((await res.json()).tools);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!draft) return;
    const isNew = !tools.some((t) => t.apiName === draft.apiName);
    const res = await fetch(isNew ? "/api/super-admin/ai-tools" : `/api/super-admin/ai-tools/${draft.apiName}`, {
      method: isNew ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    if (!res.ok) { setError("Save failed"); return; }
    setDraft(null); await load();
  };
  const remove = async (apiName: string) => {
    if (!confirm(`Delete ${apiName}?`)) return;
    await fetch(`/api/super-admin/ai-tools/${apiName}`, { method: "DELETE" });
    await load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2"><RiRobot2Line /> AI Tools &amp; APIs</h1>
          <p className="text-gray-600 mt-1">Define billable AI/API/video tools, base cost and markup.</p>
        </div>
        <button onClick={() => setDraft({ ...EMPTY })} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg">
          <RiAddLine /> Add tool
        </button>
      </div>

      {error && <div className="text-red-600 text-sm">{error}</div>}
      {loading ? <p>Loading…</p> : (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left border-b">
              <th className="p-3">Name</th><th>apiName</th><th>Category</th><th>Cost model</th>
              <th>Base price</th><th>Unit</th><th>Free quota</th><th>Markup %</th><th>Enabled</th><th></th>
            </tr></thead>
            <tbody>
              {tools.map((t) => (
                <tr key={t.apiName} className="border-b">
                  <td className="p-3 font-medium">{t.displayName}</td>
                  <td><code>{t.apiName}</code></td><td>{t.category}</td><td>{t.costModel}</td>
                  <td>€{t.basePrice}</td><td>{t.unitLabel}</td><td>{t.freeQuota}</td><td>{t.markupPercent}%</td>
                  <td>{t.enabled ? "✓" : "—"}</td>
                  <td className="whitespace-nowrap">
                    <button className="text-blue-600 mr-3" onClick={() => setDraft({ ...t })}>Edit</button>
                    <button className="text-red-600" onClick={() => remove(t.apiName)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {draft && (
        <div className="bg-white rounded-lg shadow p-6 space-y-3 max-w-2xl">
          <h2 className="text-lg font-semibold">{tools.some((t) => t.apiName === draft.apiName) ? "Edit" : "New"} tool</h2>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">apiName<input className="border p-2 w-full rounded" value={draft.apiName} onChange={(e) => setDraft({ ...draft, apiName: e.target.value })} /></label>
            <label className="text-sm">Display name<input className="border p-2 w-full rounded" value={draft.displayName} onChange={(e) => setDraft({ ...draft, displayName: e.target.value })} /></label>
            <label className="text-sm">Category
              <select className="border p-2 w-full rounded" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
                <option value="ai">ai</option><option value="api">api</option><option value="video">video</option>
              </select></label>
            <label className="text-sm">Cost model
              <select className="border p-2 w-full rounded" value={draft.costModel} onChange={(e) => setDraft({ ...draft, costModel: e.target.value })}>
                <option>per_token</option><option>per_minute</option><option>per_gb</option><option>per_request</option><option>per_email</option>
              </select></label>
            <label className="text-sm">Base price (€/unit)<input type="number" step="0.0001" className="border p-2 w-full rounded" value={draft.basePrice} onChange={(e) => setDraft({ ...draft, basePrice: Number(e.target.value) })} /></label>
            <label className="text-sm">Unit label<input className="border p-2 w-full rounded" value={draft.unitLabel} onChange={(e) => setDraft({ ...draft, unitLabel: e.target.value })} /></label>
            <label className="text-sm">Free quota<input type="number" className="border p-2 w-full rounded" value={draft.freeQuota} onChange={(e) => setDraft({ ...draft, freeQuota: Number(e.target.value) })} /></label>
            <label className="text-sm">Markup %<input type="number" className="border p-2 w-full rounded" value={draft.markupPercent} onChange={(e) => setDraft({ ...draft, markupPercent: Number(e.target.value) })} /></label>
          </div>
          <div className="flex gap-2">
            <button onClick={save} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Save</button>
            <button onClick={() => setDraft(null)} className="px-4 py-2 border rounded-lg">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Manual verification**

Run `npm run dev`, visit `/super-admin/ai-tools` as SUPER_ADMIN. Add a tool, edit its markup, delete it. Confirm rows persist across reload.

- [ ] **Step 4: Commit**

```bash
git add "app/(company)/super-admin/ai-tools/"
git commit -m "feat(wallet): real AI Tools management UI over APICostConfig"
```

---

### Task 10: Company wallet API + UI

**Files:**
- Create: `app/api/super-admin/wallet/route.ts` (GET balance + ledger, POST top-up)
- Create: `app/(company)/super-admin/billing/company-wallet/page.tsx`
- Create: `app/(company)/super-admin/billing/company-wallet/CompanyWalletClient.tsx`

- [ ] **Step 1: Implement the API**

`app/api/super-admin/wallet/route.ts`:

```ts
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { creditWallet } from "@/lib/wallet/ledger";
import { COMPANY_WALLET_ID } from "@/lib/wallet/metering";

async function requireSuperAdmin() {
  const session = await auth();
  return session?.user && (session.user as any).role === "SUPER_ADMIN" ? session : null;
}
const forbidden = () => new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403 });

export async function GET() {
  if (!(await requireSuperAdmin())) return forbidden();
  const wallet = await db.wallet.findUnique({ where: { ownerType_ownerId: { ownerType: "COMPANY", ownerId: COMPANY_WALLET_ID } } });
  const ledger = wallet
    ? await db.walletTransaction.findMany({ where: { walletId: wallet.id }, orderBy: { createdAt: "desc" }, take: 100 })
    : [];
  return Response.json({ balanceEur: wallet ? Number(wallet.balanceEur) : 0, lowBalanceEur: wallet?.lowBalanceEur ?? null, ledger });
}

export async function POST(request: Request) {
  const session = await requireSuperAdmin();
  if (!session) return forbidden();
  const b = await request.json();
  const amount = Number(b.amountEur);
  if (!Number.isFinite(amount) || amount <= 0) return new Response(JSON.stringify({ error: "amountEur must be > 0" }), { status: 400 });
  const res = await creditWallet({
    ownerType: "COMPANY", ownerId: COMPANY_WALLET_ID, type: "TOPUP",
    amountEur: amount, description: b.description || "Wholesale credit purchase",
    refType: "manual", createdById: (session.user as any).id,
  });
  return Response.json({ balanceAfter: res.balanceAfter });
}
```

- [ ] **Step 2: Implement the page + client**

`app/(company)/super-admin/billing/company-wallet/page.tsx`:

```tsx
import CompanyWalletClient from "./CompanyWalletClient";
export default function Page() { return <CompanyWalletClient />; }
```

`app/(company)/super-admin/billing/company-wallet/CompanyWalletClient.tsx` — fetch `GET /api/super-admin/wallet`, show balance card, a "Credit €" form (`POST`), and the ledger table:

```tsx
"use client";
import { useEffect, useState } from "react";
import { RiWallet3Line } from "react-icons/ri";

interface Txn { id: string; type: string; amountEur: number; balanceAfter: number; description: string; createdAt: string; }

export default function CompanyWalletClient() {
  const [balance, setBalance] = useState(0);
  const [ledger, setLedger] = useState<Txn[]>([]);
  const [amount, setAmount] = useState("");
  const load = async () => {
    const res = await fetch("/api/super-admin/wallet");
    if (res.ok) { const d = await res.json(); setBalance(d.balanceEur); setLedger(d.ledger); }
  };
  useEffect(() => { load(); }, []);
  const credit = async () => {
    const res = await fetch("/api/super-admin/wallet", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amountEur: Number(amount) }) });
    if (res.ok) { setAmount(""); await load(); }
  };
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold flex items-center gap-2"><RiWallet3Line /> Company Wallet</h1>
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-600">Wholesale credit balance</p>
        <p className="text-3xl font-bold">€{balance.toFixed(2)}</p>
        <div className="mt-4 flex gap-2">
          <input className="border p-2 rounded" placeholder="€ amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <button onClick={credit} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Credit</button>
        </div>
      </div>
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left border-b"><th className="p-3">Date</th><th>Type</th><th>Amount</th><th>Balance</th><th>Description</th></tr></thead>
          <tbody>{ledger.map((t) => (
            <tr key={t.id} className="border-b"><td className="p-3">{new Date(t.createdAt).toLocaleString()}</td><td>{t.type}</td>
              <td className={t.amountEur < 0 ? "text-red-600" : "text-green-600"}>€{t.amountEur.toFixed(4)}</td>
              <td>€{t.balanceAfter.toFixed(4)}</td><td>{t.description}</td></tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Manual verification**

Visit `/super-admin/billing/company-wallet`, credit €100, confirm balance and a TOPUP ledger row. Trigger an AI action (Task 7) and confirm a DEBIT row appears reducing the balance.

- [ ] **Step 4: Commit**

```bash
git add "app/api/super-admin/wallet/" "app/(company)/super-admin/billing/company-wallet/"
git commit -m "feat(wallet): company wallet API + super-admin UI"
```

---

## Phase 3 — Admin: metered plans + customer wallets overview

### Task 11: Metered plans API

**Files:**
- Create: `app/api/admin/metered-plans/route.ts` (GET list with customers, PUT upsert)

- [ ] **Step 1: Implement**

`app/api/admin/metered-plans/route.ts`:

```ts
import { requirePermission } from "@/lib/rbac/permissions";
import { db } from "@/lib/db";

export async function GET() {
  await requirePermission("costs", "read");
  const customers = await db.customer.findMany({
    select: { id: true, name: true, meteredPlan: true },
    orderBy: { name: "asc" },
  });
  return Response.json({ customers });
}

export async function PUT(request: Request) {
  await requirePermission("costs", "update");
  const b = await request.json();
  if (!b.customerId) return new Response(JSON.stringify({ error: "customerId required" }), { status: 400 });
  const plan = await db.customerMeteredPlan.upsert({
    where: { customerId: b.customerId },
    create: {
      customerId: b.customerId,
      monthlyAllowanceEur: Number(b.monthlyAllowanceEur) || 0,
      rollover: !!b.rollover,
      adminMarkupPercent: Number(b.adminMarkupPercent) || 0,
      active: b.active !== false,
    },
    update: {
      monthlyAllowanceEur: b.monthlyAllowanceEur !== undefined ? Number(b.monthlyAllowanceEur) : undefined,
      rollover: typeof b.rollover === "boolean" ? b.rollover : undefined,
      adminMarkupPercent: b.adminMarkupPercent !== undefined ? Number(b.adminMarkupPercent) : undefined,
      active: typeof b.active === "boolean" ? b.active : undefined,
    },
  });
  return Response.json({ plan });
}
```

> Verify the RBAC module key: check `lib/rbac/*` for the registered key covering costs/billing (the seed uses a `costs` module per the AI Κόστη menu). If the key differs, use the correct one. `requirePermission` throws on failure (handled by the framework's error boundary) — confirm the existing routes rely on that behavior; if they return 403 explicitly, mirror that.

- [ ] **Step 2: Manual verification**

As an admin, `curl` (with a signed-in session) `GET /api/admin/metered-plans`; expect customers with `meteredPlan: null` initially. `PUT` a plan and re-GET to confirm persistence.

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/metered-plans/
git commit -m "feat(wallet): admin metered-plans API (upsert per customer)"
```

---

### Task 12: Metered plans UI

**Files:**
- Create: `app/(company)/admin/metered-plans/page.tsx`
- Create: `app/(company)/admin/metered-plans/MeteredPlansClient.tsx`

- [ ] **Step 1: Implement page + client**

`page.tsx`:

```tsx
import MeteredPlansClient from "./MeteredPlansClient";
export default function Page() { return <MeteredPlansClient />; }
```

`MeteredPlansClient.tsx` — fetch `GET /api/admin/metered-plans`, render a row per customer with editable `monthlyAllowanceEur`, `rollover` toggle, `adminMarkupPercent`, `active`; save via `PUT`:

```tsx
"use client";
import { useEffect, useState } from "react";
import { RiPriceTag3Line } from "react-icons/ri";

interface Row { id: string; name: string; meteredPlan: null | { monthlyAllowanceEur: number; rollover: boolean; adminMarkupPercent: number; active: boolean }; }

export default function MeteredPlansClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const load = async () => { const r = await fetch("/api/admin/metered-plans"); if (r.ok) setRows((await r.json()).customers); };
  useEffect(() => { load(); }, []);

  const save = async (customerId: string, patch: any) => {
    await fetch("/api/admin/metered-plans", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerId, ...patch }) });
    await load();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold flex items-center gap-2"><RiPriceTag3Line /> Πακέτα Χρεώσεων</h1>
      <p className="text-gray-600">Μηνιαίο allowance AI/API/video ανά πελάτη + το δικό σας markup.</p>
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left border-b"><th className="p-3">Πελάτης</th><th>Μηνιαίο €</th><th>Rollover</th><th>Markup %</th><th>Ενεργό</th><th></th></tr></thead>
          <tbody>
            {rows.map((r) => {
              const p = r.meteredPlan ?? { monthlyAllowanceEur: 0, rollover: false, adminMarkupPercent: 0, active: true };
              return (
                <tr key={r.id} className="border-b">
                  <td className="p-3 font-medium">{r.name}</td>
                  <td><input type="number" defaultValue={p.monthlyAllowanceEur} className="border p-1 w-24 rounded" id={`m-${r.id}`} /></td>
                  <td><input type="checkbox" defaultChecked={p.rollover} id={`r-${r.id}`} /></td>
                  <td><input type="number" defaultValue={p.adminMarkupPercent} className="border p-1 w-20 rounded" id={`k-${r.id}`} /></td>
                  <td><input type="checkbox" defaultChecked={p.active} id={`a-${r.id}`} /></td>
                  <td><button className="text-blue-600" onClick={() => save(r.id, {
                    monthlyAllowanceEur: Number((document.getElementById(`m-${r.id}`) as HTMLInputElement).value),
                    rollover: (document.getElementById(`r-${r.id}`) as HTMLInputElement).checked,
                    adminMarkupPercent: Number((document.getElementById(`k-${r.id}`) as HTMLInputElement).value),
                    active: (document.getElementById(`a-${r.id}`) as HTMLInputElement).checked,
                  })}>Αποθήκευση</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add sidebar entry**

Add a nav item for `/admin/metered-plans` in the admin sidebar (find the admin `SidebarNav` config used by the existing admin costs page and add an entry labeled "Πακέτα Χρεώσεων", icon `RiPriceTag3Line`, guarded by the same `costs` permission).

- [ ] **Step 3: Manual verification**

Visit `/admin/metered-plans`, set a customer to €10/month, 30% markup, save, reload — values persist. Confirm a `CustomerMeteredPlan` row in Prisma Studio.

- [ ] **Step 4: Commit**

```bash
git add "app/(company)/admin/metered-plans/"
git commit -m "feat(wallet): admin metered-plans UI + sidebar entry"
```

---

### Task 13: Customer wallets overview (admin)

**Files:**
- Create: `app/api/admin/customer-wallets/route.ts` (GET list, POST manual adjustment)
- Create: `app/(company)/admin/customer-wallets/page.tsx` + `CustomerWalletsClient.tsx`

- [ ] **Step 1: Implement API**

`app/api/admin/customer-wallets/route.ts`:

```ts
import { requirePermission } from "@/lib/rbac/permissions";
import { db } from "@/lib/db";
import { creditWallet } from "@/lib/wallet/ledger";

export async function GET() {
  await requirePermission("costs", "read");
  const customers = await db.customer.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
  const wallets = await db.wallet.findMany({ where: { ownerType: "CUSTOMER" } });
  const byId = new Map(wallets.map((w) => [w.ownerId, w]));
  const rows = customers.map((c) => ({ id: c.id, name: c.name, balanceEur: byId.has(c.id) ? Number(byId.get(c.id)!.balanceEur) : 0, lowBalanceEur: byId.get(c.id)?.lowBalanceEur ?? null }));
  return Response.json({ rows });
}

export async function POST(request: Request) {
  await requirePermission("costs", "update");
  const b = await request.json();
  const amount = Number(b.amountEur);
  if (!b.customerId || !Number.isFinite(amount) || amount === 0) return new Response(JSON.stringify({ error: "customerId and non-zero amountEur required" }), { status: 400 });
  const res = await creditWallet({
    ownerType: "CUSTOMER", ownerId: b.customerId, type: "ADJUSTMENT",
    amountEur: amount, description: b.description || "Manual adjustment", refType: "manual",
  });
  return Response.json({ balanceAfter: res.balanceAfter });
}
```

- [ ] **Step 2: Implement UI**

`page.tsx` renders `CustomerWalletsClient`. The client fetches `GET /api/admin/customer-wallets`, lists customers with balance (low balances in red), and a small "+€ / adjust" input that `POST`s an `ADJUSTMENT`. Model it on `CompanyWalletClient` (Task 10, Step 2) with a per-row adjust control.

- [ ] **Step 3: Manual verification**

Visit `/admin/customer-wallets`, add €10 to a customer, confirm balance updates and a ledger `ADJUSTMENT` row exists.

- [ ] **Step 4: Commit**

```bash
git add "app/api/admin/customer-wallets/" "app/(company)/admin/customer-wallets/"
git commit -m "feat(wallet): admin customer-wallets overview + manual adjustment"
```

---

## Phase 4 — Customer portal wallet + Viva top-up

### Task 14: Customer wallet API (self-service)

**Files:**
- Create: `app/api/wallet/me/route.ts` (GET own balance + ledger)

- [ ] **Step 1: Implement**

`app/api/wallet/me/route.ts`:

```ts
import { auth } from "@/auth";
import { db } from "@/lib/db";

/** Resolve the customerId owned by the signed-in portal user. Adjust the relation to match the schema. */
async function currentCustomerId(): Promise<string | null> {
  const session = await auth();
  const userId = (session?.user as any)?.id;
  if (!userId) return null;
  const user = await db.user.findUnique({ where: { id: userId }, select: { customerId: true } });
  return user?.customerId ?? null;
}

export async function GET() {
  const customerId = await currentCustomerId();
  if (!customerId) return new Response(JSON.stringify({ error: "no_customer" }), { status: 403 });
  const wallet = await db.wallet.findUnique({ where: { ownerType_ownerId: { ownerType: "CUSTOMER", ownerId: customerId } } });
  const plan = await db.customerMeteredPlan.findUnique({ where: { customerId } });
  const ledger = wallet ? await db.walletTransaction.findMany({ where: { walletId: wallet.id }, orderBy: { createdAt: "desc" }, take: 50 }) : [];
  return Response.json({
    balanceEur: wallet ? Number(wallet.balanceEur) : 0,
    monthlyAllowanceEur: plan ? Number(plan.monthlyAllowanceEur) : 0,
    ledger,
  });
}
```

> Verify how a portal user links to a Customer: check the `User` model for `customerId` (or an intermediate relation). If the link differs, adjust `currentCustomerId`. This is the same isolation boundary as `resolveCustomerId`.

- [ ] **Step 2: Commit**

```bash
git add app/api/wallet/me/
git commit -m "feat(wallet): customer self-service wallet API"
```

---

### Task 15: Viva top-up

**Files:**
- Create: `app/api/wallet/topup/route.ts` (POST → create Viva order, return checkout URL)
- Create: `app/api/wallet/topup/callback/route.ts` (payment success → credit wallet)

- [ ] **Step 1: Inspect the existing Viva flow**

Run: `grep -rn -i "viva" app/actions/properties.ts app/(company)/super-admin/properties/PropertiesClient.tsx`
Identify the helper/pattern used to create a Viva payment order and the success callback. Reuse the same env vars and order-creation call.

- [ ] **Step 2: Implement top-up initiation**

`app/api/wallet/topup/route.ts` — resolve the current customer (reuse `currentCustomerId` logic from Task 14; extract it to `lib/wallet/current-customer.ts` and import in both), create a Viva order for `amountEur` following the pattern from Step 1, persist a pending marker (encode `customerId` + `amountEur` in the Viva order's merchant reference), and return the checkout URL.

```ts
import { db } from "@/lib/db";
import { currentCustomerId } from "@/lib/wallet/current-customer";
// import { createVivaOrder } from "<the helper identified in Step 1>";

export async function POST(request: Request) {
  const customerId = await currentCustomerId();
  if (!customerId) return new Response(JSON.stringify({ error: "no_customer" }), { status: 403 });
  const { amountEur } = await request.json();
  const amount = Number(amountEur);
  if (!Number.isFinite(amount) || amount <= 0) return new Response(JSON.stringify({ error: "invalid amount" }), { status: 400 });

  // Follow the existing Viva pattern: create an order with merchantTrns encoding intent.
  const merchantTrns = `wallet-topup:${customerId}:${amount}`;
  // const { checkoutUrl } = await createVivaOrder({ amountCents: Math.round(amount * 100), merchantTrns, ... });
  // return Response.json({ checkoutUrl });
  return new Response(JSON.stringify({ error: "wire createVivaOrder from Step 1" }), { status: 501 });
}
```

> This step intentionally requires reading the concrete Viva helper (Step 1) to fill `createVivaOrder`. Do not invent an endpoint — reuse the one already used for `ServiceInvoice`/property payments. If no reusable helper exists, extract one from `app/actions/properties.ts` into `lib/viva.ts` first, then import it here.

- [ ] **Step 3: Implement the success callback → credit wallet**

`app/api/wallet/topup/callback/route.ts` — verify the Viva callback (same verification the existing property flow uses), parse `merchantTrns`, and credit the customer wallet:

```ts
import { creditWallet } from "@/lib/wallet/ledger";

export async function POST(request: Request) {
  // 1. Verify the Viva webhook/callback exactly as the existing property-payment callback does.
  // 2. Parse merchantTrns = `wallet-topup:${customerId}:${amount}` from the verified payload.
  const payload = await request.json();
  const trns: string = payload?.EventData?.MerchantTrns ?? payload?.merchantTrns ?? "";
  const m = /^wallet-topup:([^:]+):([\d.]+)$/.exec(trns);
  if (!m) return new Response("ignored", { status: 200 });
  const [, customerId, amountStr] = m;
  await creditWallet({
    ownerType: "CUSTOMER", ownerId: customerId, type: "TOPUP",
    amountEur: Number(amountStr), description: "Viva top-up", refType: "viva", refId: payload?.EventData?.TransactionId ?? undefined,
  });
  return new Response("ok", { status: 200 });
}
```

> Match the exact verification + payload shape to the existing Viva integration found in Step 1. Do not trust an unverified callback.

- [ ] **Step 4: Manual verification**

Using Viva's sandbox, initiate a €10 top-up from the portal, complete payment, and confirm a `TOPUP` ledger row credits the customer wallet by €10.

- [ ] **Step 5: Commit**

```bash
git add app/api/wallet/topup/ lib/wallet/current-customer.ts
git commit -m "feat(wallet): Viva top-up initiation + credit-on-success callback"
```

---

### Task 16: Customer portal wallet page

**Files:**
- Create: `app/(customer)/portal/wallet/page.tsx` + `WalletClient.tsx`

> Confirm the portal route group: PROPERTY_ADMIN lands on `/portal` (per the surfaces model). Place the page under the `(customer)` route group used by the portal.

- [ ] **Step 1: Implement the page + client**

`WalletClient.tsx` fetches `GET /api/wallet/me`, shows balance + monthly allowance, the ledger history, a "Buy extra units +€10" button that `POST`s to `/api/wallet/topup` and redirects to the returned `checkoutUrl`, and a red banner when `balanceEur <= 0` ("Οι μονάδες AI εξαντλήθηκαν — αγοράστε για να συνεχίσετε").

```tsx
"use client";
import { useEffect, useState } from "react";
import { RiWallet3Line } from "react-icons/ri";

interface Txn { id: string; type: string; amountEur: number; balanceAfter: number; description: string; createdAt: string; }

export default function WalletClient() {
  const [balance, setBalance] = useState(0);
  const [allowance, setAllowance] = useState(0);
  const [ledger, setLedger] = useState<Txn[]>([]);
  const load = async () => { const r = await fetch("/api/wallet/me"); if (r.ok) { const d = await r.json(); setBalance(d.balanceEur); setAllowance(d.monthlyAllowanceEur); setLedger(d.ledger); } };
  useEffect(() => { load(); }, []);
  const topup = async () => {
    const r = await fetch("/api/wallet/topup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amountEur: 10 }) });
    if (r.ok) { const { checkoutUrl } = await r.json(); if (checkoutUrl) window.location.href = checkoutUrl; }
  };
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold flex items-center gap-2"><RiWallet3Line /> Το πορτοφόλι μου</h1>
      {balance <= 0 && <div className="p-4 bg-red-50 border border-red-300 text-red-700 rounded-lg">Οι μονάδες AI εξαντλήθηκαν — αγοράστε για να συνεχίσετε.</div>}
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-600">Υπόλοιπο</p>
        <p className="text-3xl font-bold">€{balance.toFixed(2)}</p>
        <p className="text-sm text-gray-500 mt-1">Μηνιαίο allowance: €{allowance.toFixed(2)}</p>
        <button onClick={topup} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg">Αγορά extra μονάδων +€10</button>
      </div>
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left border-b"><th className="p-3">Ημ/νία</th><th>Τύπος</th><th>Ποσό</th><th>Υπόλοιπο</th><th>Περιγραφή</th></tr></thead>
          <tbody>{ledger.map((t) => (
            <tr key={t.id} className="border-b"><td className="p-3">{new Date(t.createdAt).toLocaleString()}</td><td>{t.type}</td>
              <td className={t.amountEur < 0 ? "text-red-600" : "text-green-600"}>€{t.amountEur.toFixed(4)}</td>
              <td>€{t.balanceAfter.toFixed(4)}</td><td>{t.description}</td></tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add a portal nav entry** for `/portal/wallet` labeled "Πορτοφόλι", icon `RiWallet3Line`.

- [ ] **Step 3: Manual verification**

Sign in as a customer/portal user, visit `/portal/wallet`, confirm balance + ledger render; with balance 0 the red banner shows; "Buy +€10" redirects to Viva.

- [ ] **Step 4: Commit**

```bash
git add "app/(customer)/portal/wallet/"
git commit -m "feat(wallet): customer portal wallet page with Viva top-up"
```

---

## Final verification

- [ ] Run the full test suite: `npx vitest run` — all wallet tests pass.
- [ ] Typecheck: `npx tsc --noEmit` — no errors from new files.
- [ ] End-to-end sanity: super-admin adds a tool with markup → admin sets a customer's €10 plan + markup → run monthly-allowance cron → customer wallet shows €10 → AI action dual-debits company (billed) and customer (charge) → deplete → metered blocks + banner → Viva top-up restores balance.
- [ ] Commit any final fixes.

## Coverage map (spec → tasks)

- Two wallet levels, EUR, ledger → Tasks 1, 3, 10, 13.
- Markup#1 (super-admin) → Tasks 1 (schema), 8/9 (CRUD UI).
- Markup#2 (admin) → Tasks 1, 11, 12.
- Pricing chain real→billed→customer → Task 2, 5.
- Pre-flight + dual-debit + block-on-empty → Tasks 5, 7.
- Monthly allowance (reset/rollover) → Task 6.
- Super-admin AI Tools CRUD → Tasks 8, 9.
- Company wallet + wholesale top-up → Task 10.
- Admin metered plans + customer wallets → Tasks 11, 12, 13.
- Customer portal wallet + Viva top-up → Tasks 14, 15, 16.
- Video as metered apiName → Task 1 (`category=video`), consumed via Task 5 (unchanged code path).
