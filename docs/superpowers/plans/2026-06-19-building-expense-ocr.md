# Building Expense OCR Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let authorized users upload a bill/receipt/invoice/utility-bill for a building, OCR-extract its data with Gemini Vision + DeepSeek, review/correct it, register it as a `BuildingExpense`, and auto-distribute it to units with a tenant/owner payer split.

**Architecture:** A lean OCR engine in `lib/ocr/` (Gemini vision/PDF + DeepSeek normalization, with model fallback and cost logging via the existing `logAPIUsage`). Pure helper modules in `lib/expenses/` (allocation math + authorization). Server actions in `app/actions/` orchestrate upload → extract → register. React panels on the building page provide upload, review modal, expense list, and per-building split settings. Prisma gains `ExpenseCategory`, `BuildingCategoryOverride`, `MeterReading`, `ExpenseAllocation` and additive `BuildingExpense` fields.

**Tech Stack:** Next.js 16.2, Prisma 7/PostgreSQL, Auth.js v5, BunnyCDN S3 (`lib/bunnycdn.ts`), Gemini + DeepSeek (OpenAI-compatible APIs), `sharp`, `zod`, Vitest, Tailwind 4.1 + shadcn/ui.

**Spec:** `docs/superpowers/specs/2026-06-19-building-expense-ocr-design.md`

---

## File Structure

**Create:**
- `lib/ocr/fetch-retry.ts` — `fetchWithRetry` (backoff on 429/503).
- `lib/ocr/model-fallback.ts` — `buildModelChain`, `tryModels`.
- `lib/ocr/cost.ts` — `logGemini` / `logDeepSeek` wrappers around `logAPIUsage`.
- `lib/ocr/prompt.ts` — system prompt + zod schemas (`ExtractedDoc`, `MeterData`).
- `lib/ocr/extract.ts` — `enhanceForOcr`, `callGeminiVision`, `callGeminiPdfNative`, `parseJsonLoose`, `extractDocument`.
- `lib/ocr/normalize.ts` — DeepSeek normalization pass.
- `lib/expenses/authz.ts` — `canManageBuildingExpenses`.
- `lib/expenses/allocation.ts` — `computeAllocation`, split resolution.
- co-located tests: `lib/ocr/model-fallback.test.ts`, `lib/ocr/extract.test.ts`, `lib/ocr/normalize.test.ts`, `lib/expenses/allocation.test.ts`, `lib/expenses/authz.test.ts`.
- `app/actions/building-expenses.ts` — extract / preview / create / update / delete / list.
- `app/actions/expense-categories.ts` — category CRUD + per-building override.
- `components/buildings/ExpensesPanel.tsx`, `ExpenseOcrUpload.tsx`, `ExpenseReviewForm.tsx`, `CategorySplitSettings.tsx`.
- `app/(dashboard)/super-admin/settings/expense-categories/page.tsx` + `expense-categories-client.tsx`.

**Modify:**
- `prisma/schema.prisma` — new models/enums + `BuildingExpense`/`InfraPoint`/`Building`/`Unit`/`User` back-relations + `BuildingFileCategory` `RECEIPT`.
- `prisma/seed.ts` (or a dedicated seed function) — default categories.
- `app/(dashboard)/super-admin/buildings/[id]/page.tsx` — mount `ExpensesPanel` + `CategorySplitSettings`.
- `package.json` — add `sharp`.

---

## Task 1: Prisma schema — models, enums, relations

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add enums** near the other enums:

```prisma
enum ExpenseUtilityType { NONE POWER WATER GAS }
enum ExpenseStatus { DRAFT CONFIRMED }
enum MeterType { POWER WATER GAS }
```

- [ ] **Step 2: Add `RECEIPT` to `BuildingFileCategory`**

```prisma
enum BuildingFileCategory {
  PLANS
  PHOTOS
  DOCUMENTS
  CERTIFICATES
  RECEIPT
  OTHER
}
```

- [ ] **Step 3: Add new models** (place after `BuildingExpense`):

```prisma
model ExpenseCategory {
  id        String  @id @default(cuid())
  name      String
  code      String  @unique
  utilityType ExpenseUtilityType @default(NONE)
  defaultTenantPct Int @default(0)
  defaultOwnerPct  Int @default(100)
  active    Boolean @default(true)
  sortOrder Int     @default(0)
  expenses  BuildingExpense[]
  overrides BuildingCategoryOverride[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model BuildingCategoryOverride {
  id         String   @id @default(cuid())
  buildingId String
  building   Building @relation(fields: [buildingId], references: [id], onDelete: Cascade)
  categoryId String
  category   ExpenseCategory @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  tenantPct  Int
  ownerPct   Int
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  @@unique([buildingId, categoryId])
  @@index([buildingId])
}

model MeterReading {
  id             String   @id @default(cuid())
  buildingId     String
  building       Building @relation(fields: [buildingId], references: [id], onDelete: Cascade)
  infraPointId   String?
  infraPoint     InfraPoint? @relation(fields: [infraPointId], references: [id], onDelete: SetNull)
  expenseId      String?
  expense        BuildingExpense? @relation(fields: [expenseId], references: [id], onDelete: SetNull)
  meterType      MeterType
  meterNumber    String?
  periodFrom     DateTime?
  periodTo       DateTime?
  previousReading Decimal? @db.Decimal(12,3)
  currentReading  Decimal? @db.Decimal(12,3)
  consumption     Decimal? @db.Decimal(12,3)
  unit           String?
  createdAt      DateTime @default(now())
  @@index([buildingId])
  @@index([infraPointId])
}

model ExpenseAllocation {
  id           String  @id @default(cuid())
  expenseId    String
  expense      BuildingExpense @relation(fields: [expenseId], references: [id], onDelete: Cascade)
  unitId       String
  unit         Unit    @relation(fields: [unitId], references: [id], onDelete: Cascade)
  unitShare    Decimal @db.Decimal(10,2)
  tenantUserId String?
  tenantAmount Decimal @db.Decimal(10,2) @default(0)
  ownerUserId  String?
  ownerAmount  Decimal @db.Decimal(10,2) @default(0)
  createdAt    DateTime @default(now())
  @@index([expenseId])
  @@index([unitId])
}
```

- [ ] **Step 4: Extend `BuildingExpense`** — add fields after `receiptFile`:

```prisma
  categoryId     String?
  categoryRef    ExpenseCategory? @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  supplierName   String?
  supplierVat    String?
  documentNumber String?
  documentDate   DateTime?
  netAmount      Decimal? @db.Decimal(10, 2)
  vatAmount      Decimal? @db.Decimal(10, 2)
  status         ExpenseStatus @default(CONFIRMED)
  tenantPct      Int      @default(0)
  ownerPct       Int      @default(100)
  ocrRaw         Json?
  ocrConfidence  Float?
  meterReadings  MeterReading[]
  allocations    ExpenseAllocation[]
```
And add `@@index([categoryId])`.

- [ ] **Step 5: Add back-relations** to existing models:
  - `Building`: `categoryOverrides BuildingCategoryOverride[]` and `meterReadings MeterReading[]`
  - `InfraPoint`: `meterReadings MeterReading[]`
  - `Unit`: `expenseAllocations ExpenseAllocation[]`

- [ ] **Step 6: Create the migration**

Run: `npx prisma migrate dev --name building_expense_ocr`
Expected: migration created and applied; Prisma Client regenerated with no errors.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): expense OCR models — categories, overrides, meter readings, allocations"
```

---

## Task 2: Seed default expense categories

**Files:**
- Create: `prisma/seed-expense-categories.ts`
- Modify: `prisma/seed.ts` (call the new function)

- [ ] **Step 1: Write the seed module**

```ts
// prisma/seed-expense-categories.ts
import { PrismaClient } from "@/lib/prisma/client";

type Cat = { code: string; name: string; utilityType: "NONE" | "POWER" | "WATER" | "GAS"; tenant: number; owner: number; sortOrder: number };

export const DEFAULT_EXPENSE_CATEGORIES: Cat[] = [
  { code: "POWER",          name: "Ρεύμα κοινοχρήστων / ΔΕΗ", utilityType: "POWER", tenant: 100, owner: 0, sortOrder: 1 },
  { code: "WATER",          name: "Νερό / ΕΥΔΑΠ-ΕΥΑΘ",        utilityType: "WATER", tenant: 100, owner: 0, sortOrder: 2 },
  { code: "GAS",            name: "Φυσικό αέριο / Θέρμανση",   utilityType: "GAS",   tenant: 100, owner: 0, sortOrder: 3 },
  { code: "CLEANING",       name: "Καθαριότητα",               utilityType: "NONE",  tenant: 100, owner: 0, sortOrder: 4 },
  { code: "MANAGEMENT",     name: "Διαχείριση",                utilityType: "NONE",  tenant: 100, owner: 0, sortOrder: 5 },
  { code: "ELEVATOR_OP",    name: "Ανελκυστήρας – Λειτουργία",  utilityType: "NONE",  tenant: 100, owner: 0, sortOrder: 6 },
  { code: "ELEVATOR_MAINT", name: "Ανελκυστήρας – Συντήρηση",   utilityType: "NONE",  tenant: 0,   owner: 100, sortOrder: 7 },
  { code: "MAINTENANCE",    name: "Συντήρηση / Επισκευές",     utilityType: "NONE",  tenant: 0,   owner: 100, sortOrder: 8 },
  { code: "INSURANCE",      name: "Ασφάλεια",                  utilityType: "NONE",  tenant: 0,   owner: 100, sortOrder: 9 },
  { code: "RESERVE",        name: "Αποθεματικό",               utilityType: "NONE",  tenant: 0,   owner: 100, sortOrder: 10 },
  { code: "OTHER",          name: "Λοιπά",                     utilityType: "NONE",  tenant: 0,   owner: 100, sortOrder: 11 },
];

export async function seedExpenseCategories(db: PrismaClient) {
  for (const c of DEFAULT_EXPENSE_CATEGORIES) {
    await db.expenseCategory.upsert({
      where: { code: c.code },
      update: {},  // do not clobber admin edits on re-seed
      create: {
        code: c.code, name: c.name, utilityType: c.utilityType,
        defaultTenantPct: c.tenant, defaultOwnerPct: c.owner, sortOrder: c.sortOrder,
      },
    });
  }
}
```

> Note: confirm the correct generated-client import path by checking how
> `prisma/seed.ts` currently imports `PrismaClient` and match it exactly.

- [ ] **Step 2: Call it from `prisma/seed.ts`** — import `seedExpenseCategories` and `await seedExpenseCategories(prisma)` inside the existing main seed function, using the existing client instance.

- [ ] **Step 3: Run the seed**

Run: `npx prisma db seed`
Expected: completes; `npx prisma studio` (or a quick query) shows 11 `ExpenseCategory` rows.

- [ ] **Step 4: Commit**

```bash
git add prisma/seed-expense-categories.ts prisma/seed.ts
git commit -m "feat(db): seed default expense categories with payer splits"
```

---

## Task 3: Authorization helper (`lib/expenses/authz.ts`)

**Files:**
- Create: `lib/expenses/authz.ts`
- Test: `lib/expenses/authz.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/expenses/authz.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const findUnique = vi.fn();
const findFirst = vi.fn();
vi.mock("@/lib/db", () => ({ db: { user: { findUnique: (...a: any[]) => findUnique(...a) }, managementAssignment: { findFirst: (...a: any[]) => findFirst(...a) } } }));

import { canManageBuildingExpenses } from "./authz";

beforeEach(() => { findUnique.mockReset(); findFirst.mockReset(); });

describe("canManageBuildingExpenses", () => {
  it("allows company SUPER_ADMIN without an assignment", async () => {
    findUnique.mockResolvedValue({ role: "SUPER_ADMIN" });
    expect(await canManageBuildingExpenses("u1", "b1")).toBe(true);
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("allows a building manager via ManagementAssignment", async () => {
    findUnique.mockResolvedValue({ role: "PROPERTY_ADMIN" });
    findFirst.mockResolvedValue({ id: "ma1" });
    expect(await canManageBuildingExpenses("u2", "b1")).toBe(true);
  });

  it("rejects an unrelated user", async () => {
    findUnique.mockResolvedValue({ role: "PROPERTY_ADMIN" });
    findFirst.mockResolvedValue(null);
    expect(await canManageBuildingExpenses("u3", "b1")).toBe(false);
  });

  it("rejects unknown user", async () => {
    findUnique.mockResolvedValue(null);
    expect(await canManageBuildingExpenses("u4", "b1")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/expenses/authz.test.ts`
Expected: FAIL — cannot find module `./authz`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/expenses/authz.ts
import { db } from "@/lib/db";

const COMPANY_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER"];

/** True if the user may register/edit/delete expenses for this building:
 *  company staff (SUPER_ADMIN/ADMIN/MANAGER) OR a building-level manager. */
export async function canManageBuildingExpenses(userId: string, buildingId: string): Promise<boolean> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!user) return false;
  if (COMPANY_ROLES.includes(user.role)) return true;
  const assignment = await db.managementAssignment.findFirst({
    where: { userId, OR: [{ buildingId }, { building: { id: buildingId } }] },
    select: { id: true },
  });
  return !!assignment;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/expenses/authz.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/expenses/authz.ts lib/expenses/authz.test.ts
git commit -m "feat(expenses): building-expense authorization helper"
```

---

## Task 4: Allocation math (`lib/expenses/allocation.ts`)

**Files:**
- Create: `lib/expenses/allocation.ts`
- Test: `lib/expenses/allocation.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/expenses/allocation.test.ts
import { describe, it, expect } from "vitest";
import { computeAllocation, type AllocUnit } from "./allocation";

const units: AllocUnit[] = [
  { unitId: "a", millesimes: 500, ownerUserId: "o1", tenantUserId: "t1" },
  { unitId: "b", millesimes: 300, ownerUserId: "o2", tenantUserId: null },
  { unitId: "c", millesimes: 200, ownerUserId: "o3", tenantUserId: "t3" },
];

describe("computeAllocation", () => {
  it("distributes by millesimes and sums to total", () => {
    const rows = computeAllocation({ total: 100, tenantPct: 100, ownerPct: 0, units });
    expect(rows.map(r => r.unitShare)).toEqual([50, 30, 20]);
    const sum = rows.reduce((s, r) => s + r.unitShare, 0);
    expect(sum).toBe(100);
  });

  it("splits each share by tenant/owner pct", () => {
    const rows = computeAllocation({ total: 100, tenantPct: 60, ownerPct: 40, units });
    expect(rows[0].tenantAmount).toBe(30); // 50 * 0.6
    expect(rows[0].ownerAmount).toBe(20);  // 50 * 0.4
  });

  it("absorbs rounding remainder in the last unit so the sum is exact", () => {
    const u: AllocUnit[] = [
      { unitId: "x", millesimes: 1, ownerUserId: null, tenantUserId: null },
      { unitId: "y", millesimes: 1, ownerUserId: null, tenantUserId: null },
      { unitId: "z", millesimes: 1, ownerUserId: null, tenantUserId: null },
    ];
    const rows = computeAllocation({ total: 100, tenantPct: 0, ownerPct: 100, units: u });
    const sum = rows.reduce((s, r) => s + r.unitShare, 0);
    expect(sum).toBe(100);
    expect(rows[2].unitShare).toBeCloseTo(33.34, 2);
  });

  it("flags units with null/zero millesimes and excludes them from the weight base", () => {
    const u: AllocUnit[] = [
      { unitId: "a", millesimes: 600, ownerUserId: null, tenantUserId: null },
      { unitId: "b", millesimes: null, ownerUserId: null, tenantUserId: null },
    ];
    const rows = computeAllocation({ total: 100, tenantPct: 0, ownerPct: 100, units: u });
    expect(rows.find(r => r.unitId === "a")!.unitShare).toBe(100);
    expect(rows.find(r => r.unitId === "b")!.unitShare).toBe(0);
    expect(rows.find(r => r.unitId === "b")!.missingMillesimes).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/expenses/allocation.test.ts`
Expected: FAIL — cannot find module `./allocation`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/expenses/allocation.ts
export type AllocUnit = {
  unitId: string;
  millesimes: number | null;
  ownerUserId: string | null;
  tenantUserId: string | null;
};

export type AllocRow = {
  unitId: string;
  unitShare: number;
  tenantUserId: string | null;
  tenantAmount: number;
  ownerUserId: string | null;
  ownerAmount: number;
  missingMillesimes: boolean;
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Distribute `total` across units by χιλιοστά, then split each unit's share
 *  into tenant/owner amounts. The last weighted unit absorbs the rounding
 *  remainder so the sum equals `total` exactly. Units with null/zero millesimes
 *  get a zero share and are flagged `missingMillesimes`. */
export function computeAllocation(args: {
  total: number; tenantPct: number; ownerPct: number; units: AllocUnit[];
}): AllocRow[] {
  const { total, tenantPct, ownerPct, units } = args;
  const weight = units.reduce((s, u) => s + (u.millesimes && u.millesimes > 0 ? u.millesimes : 0), 0);
  const weighted = units.filter((u) => u.millesimes && u.millesimes > 0);
  const lastWeightedId = weighted.length ? weighted[weighted.length - 1].unitId : null;

  let running = 0;
  return units.map((u) => {
    const hasWeight = !!(u.millesimes && u.millesimes > 0);
    let share = 0;
    if (weight > 0 && hasWeight) {
      if (u.unitId === lastWeightedId) {
        share = round2(total - running);
      } else {
        share = round2((total * (u.millesimes as number)) / weight);
        running += share;
      }
    }
    const tenantAmount = round2((share * tenantPct) / 100);
    const ownerAmount = round2(share - tenantAmount);
    return {
      unitId: u.unitId,
      unitShare: share,
      tenantUserId: u.tenantUserId,
      tenantAmount,
      ownerUserId: u.ownerUserId,
      ownerAmount,
      missingMillesimes: !hasWeight,
    };
  });
}

/** Resolve the effective split for a category in a building: a
 *  BuildingCategoryOverride wins over the category default. */
export function resolveSplit(
  category: { defaultTenantPct: number; defaultOwnerPct: number },
  override: { tenantPct: number; ownerPct: number } | null,
): { tenantPct: number; ownerPct: number } {
  if (override) return { tenantPct: override.tenantPct, ownerPct: override.ownerPct };
  return { tenantPct: category.defaultTenantPct, ownerPct: category.defaultOwnerPct };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/expenses/allocation.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/expenses/allocation.ts lib/expenses/allocation.test.ts
git commit -m "feat(expenses): millième + tenant/owner allocation math"
```

---

## Task 5: OCR fetch-retry + model-fallback

**Files:**
- Create: `lib/ocr/fetch-retry.ts`, `lib/ocr/model-fallback.ts`
- Test: `lib/ocr/model-fallback.test.ts`

- [ ] **Step 1: Write `fetch-retry.ts`**

```ts
// lib/ocr/fetch-retry.ts
type RetryOpts = { retries?: number; baseMs?: number; label?: string };

/** fetch() wrapper that retries on network errors and 429/503 with exponential
 *  backoff. Non-retryable HTTP responses are returned as-is for the caller to read. */
export async function fetchWithRetry(url: string, init: RequestInit, opts: RetryOpts = {}): Promise<Response> {
  const retries = opts.retries ?? 3;
  const baseMs = opts.baseMs ?? 400;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, init);
      if (res.status !== 429 && res.status !== 503) return res;
      if (attempt === retries) return res;
    } catch (err) {
      lastErr = err;
      if (attempt === retries) throw err;
    }
    await new Promise((r) => setTimeout(r, baseMs * Math.pow(2, attempt)));
  }
  throw lastErr ?? new Error("fetchWithRetry: exhausted");
}
```

- [ ] **Step 2: Write the failing test for model-fallback**

```ts
// lib/ocr/model-fallback.test.ts
import { describe, it, expect, vi } from "vitest";
import { buildModelChain, tryModels } from "./model-fallback";

describe("buildModelChain", () => {
  it("puts primary first and dedups fallbacks", () => {
    expect(buildModelChain("a", ["b", "a", "c"])).toEqual(["a", "b", "c"]);
  });
});

describe("tryModels", () => {
  it("returns the first ok value without calling later models", async () => {
    const fn = vi.fn(async (m: string) => ({ ok: true as const, value: m }));
    const out = await tryModels(["a", "b"], fn);
    expect(out).toBe("a");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("falls through on error and throws the last error if all fail", async () => {
    const fn = vi.fn(async (m: string) => ({ ok: false as const, error: new Error(`fail ${m}`) }));
    await expect(tryModels(["a", "b"], fn)).rejects.toThrow("fail b");
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run lib/ocr/model-fallback.test.ts`
Expected: FAIL — cannot find module `./model-fallback`.

- [ ] **Step 4: Write `model-fallback.ts`**

```ts
// lib/ocr/model-fallback.ts
export type TryResult<T> = { ok: true; value: T } | { ok: false; error: Error };

/** primary model first, then de-duplicated fallbacks. */
export function buildModelChain(primary: string, fallbacks: string[]): string[] {
  const seen = new Set<string>([primary]);
  const chain = [primary];
  for (const m of fallbacks) {
    if (!seen.has(m)) { seen.add(m); chain.push(m); }
  }
  return chain;
}

/** Try each model in order; return the first ok value. Throw the last error if all fail. */
export async function tryModels<T>(chain: string[], fn: (model: string) => Promise<TryResult<T>>): Promise<T> {
  let lastErr: Error = new Error("tryModels: empty chain");
  for (const model of chain) {
    const r = await fn(model);
    if (r.ok) return r.value;
    lastErr = r.error;
  }
  throw lastErr;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run lib/ocr/model-fallback.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/ocr/fetch-retry.ts lib/ocr/model-fallback.ts lib/ocr/model-fallback.test.ts
git commit -m "feat(ocr): fetch-retry and model-fallback helpers"
```

---

## Task 6: Cost logging wrappers (`lib/ocr/cost.ts`)

**Files:**
- Create: `lib/ocr/cost.ts`

- [ ] **Step 1: Write the module** (no separate test — thin wrapper; covered indirectly):

```ts
// lib/ocr/cost.ts
import { logAPIUsage } from "@/lib/api-costs";

type Usage = { model: string; tokens: number | null; status?: "SUCCESS" | "FAILED" };

export function logGemini(u: Usage) {
  void logAPIUsage({ apiName: "gemini", endpoint: "/ocr", model: u.model, tokensUsed: u.tokens ?? 0, status: u.status ?? "SUCCESS" });
}

export function logDeepSeek(u: Usage) {
  void logAPIUsage({ apiName: "deepseek", endpoint: "/normalize", model: u.model, tokensUsed: u.tokens ?? 0, status: u.status ?? "SUCCESS" });
}
```

> Verify `logAPIUsage` accepts these keys by reading `lib/api-costs.ts`
> (`LogAPIUsageParams`). It does: `apiName, endpoint, model, tokensUsed, status`.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors from `lib/ocr/cost.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/ocr/cost.ts
git commit -m "feat(ocr): gemini/deepseek cost-logging wrappers"
```

---

## Task 7: Prompt + zod schemas (`lib/ocr/prompt.ts`)

**Files:**
- Create: `lib/ocr/prompt.ts`

- [ ] **Step 1: Write the module**

```ts
// lib/ocr/prompt.ts
import { z } from "zod";

export const MeterDataSchema = z.object({
  meterType: z.enum(["POWER", "WATER", "GAS"]).nullable().default(null),
  meterNumber: z.string().nullable().default(null),
  unit: z.string().nullable().default(null),
  periodFrom: z.string().nullable().default(null),
  periodTo: z.string().nullable().default(null),
  previousReading: z.number().nullable().default(null),
  currentReading: z.number().nullable().default(null),
  consumption: z.number().nullable().default(null),
});

export const ExtractedDocSchema = z.object({
  docType: z.enum(["invoice", "receipt", "utility", "tax", "other"]).default("other"),
  supplierName: z.string().nullable().default(null),
  supplierVat: z.string().nullable().default(null),
  supplierDoy: z.string().nullable().default(null),
  documentNumber: z.string().nullable().default(null),
  documentDate: z.string().nullable().default(null),
  netAmount: z.number().nullable().default(null),
  vatAmount: z.number().nullable().default(null),
  totalAmount: z.number().nullable().default(null),
  suggestedCategoryCode: z.string().nullable().default(null),
  meter: MeterDataSchema.nullable().default(null),
  confidence: z.number().min(0).max(1).default(0.5),
});

export type ExtractedDoc = z.infer<typeof ExtractedDocSchema>;

export const REQUIRED_FIELDS: (keyof ExtractedDoc)[] = ["supplierName", "documentDate", "totalAmount"];

/** Count required fields that are null/empty — drives the auto-retry decision. */
export function countMissingRequired(d: Partial<ExtractedDoc>): number {
  return REQUIRED_FIELDS.filter((k) => {
    const v = d[k];
    return v == null || v === "";
  }).length;
}

export function buildSystemPrompt(categoryCodes: string[]): string {
  return [
    "Είσαι σύστημα εξαγωγής δεδομένων από ελληνικά παραστατικά (τιμολόγια, αποδείξεις, λογαριασμοί ΔΕΗ/νερού/αερίου, φορολογικά έγγραφα).",
    "Διάβασε το έγγραφο και επίστρεψε ΑΥΣΤΗΡΑ ένα JSON object με τα πεδία:",
    "docType, supplierName, supplierVat (ΑΦΜ), supplierDoy (ΔΟΥ), documentNumber, documentDate (YYYY-MM-DD), netAmount (καθαρή αξία), vatAmount (ΦΠΑ), totalAmount (σύνολο), suggestedCategoryCode, meter, confidence (0..1).",
    "Τα ποσά ως αριθμοί με τελεία υποδιαστολή (1234.56). Ό,τι δεν βρίσκεις → null.",
    "Αν είναι λογαριασμός κοινής ωφέλειας, συμπλήρωσε το αντικείμενο meter: { meterType (POWER|WATER|GAS), meterNumber, unit (kWh|m3), periodFrom, periodTo, previousReading (προηγούμενη ένδειξη), currentReading (τρέχουσα ένδειξη), consumption (κατανάλωση) }.",
    `Το suggestedCategoryCode πρέπει να είναι ΕΝΑ από: ${categoryCodes.join(", ")} ή null.`,
    "Επίστρεψε μόνο το JSON, χωρίς επεξήγηση, χωρίς markdown code fences.",
  ].join("\n");
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add lib/ocr/prompt.ts
git commit -m "feat(ocr): extraction prompt and zod schemas"
```

---

## Task 8: Extraction engine (`lib/ocr/extract.ts`)

**Files:**
- Create: `lib/ocr/extract.ts`
- Test: `lib/ocr/extract.test.ts` (covers `parseJsonLoose` only — network paths are integration-tested manually)
- Modify: `package.json` (add `sharp`)

- [ ] **Step 1: Add `sharp`**

Run: `npm install sharp`
Expected: `sharp` appears in `package.json` dependencies.

- [ ] **Step 2: Write the failing test for `parseJsonLoose`**

```ts
// lib/ocr/extract.test.ts
import { describe, it, expect } from "vitest";
import { parseJsonLoose } from "./extract";

describe("parseJsonLoose", () => {
  it("parses clean JSON", () => {
    expect(parseJsonLoose('{"a":1}')).toEqual({ a: 1 });
  });
  it("strips markdown code fences", () => {
    expect(parseJsonLoose('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });
  it("extracts the first object from surrounding prose", () => {
    expect(parseJsonLoose('Here: {"a":1} done')).toEqual({ a: 1 });
  });
  it("throws on empty input", () => {
    expect(() => parseJsonLoose("")).toThrow();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run lib/ocr/extract.test.ts`
Expected: FAIL — cannot find module `./extract`.

- [ ] **Step 4: Write `extract.ts`**

```ts
// lib/ocr/extract.ts
import sharp from "sharp";
import { env } from "@/lib/env";
import { fetchWithRetry } from "./fetch-retry";
import { buildModelChain, tryModels } from "./model-fallback";
import { logGemini } from "./cost";
import { buildSystemPrompt, ExtractedDocSchema, countMissingRequired, type ExtractedDoc } from "./prompt";

const VISION_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const PRIMARY_MODEL = "gemini-2.5-flash";
const FALLBACK_MODELS = ["gemini-2.0-flash", "gemini-2.5-flash-lite"];
const UPGRADED_MODEL = "gemini-2.5-pro";
const RETRY_MISSING_THRESHOLD = 2;

export function parseJsonLoose(s: string): any {
  if (!s) throw new Error("Empty LLM response");
  const cleaned = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try { return JSON.parse(cleaned); } catch {}
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
  throw new Error("LLM did not return valid JSON");
}

/** Best-effort image enhancement; returns the original buffer on any failure. */
export async function enhanceForOcr(input: Buffer): Promise<{ buffer: Buffer; mimeType: string }> {
  try {
    const meta = await sharp(input).metadata();
    const w = meta.width ?? 0;
    let pipe = sharp(input, { failOn: "none" });
    if (w > 0 && w < 1600) pipe = pipe.resize({ width: 1600, kernel: "lanczos3" });
    const out = await pipe.rotate().grayscale().normalize().sharpen({ sigma: 1 }).png({ compressionLevel: 8 }).toBuffer();
    return { buffer: out, mimeType: "image/png" };
  } catch {
    return { buffer: input, mimeType: "image/png" };
  }
}

async function callVision(system: string, dataUrl: string, model: string): Promise<{ content: string; tokens: number | null; model: string }> {
  return tryModels(buildModelChain(model, FALLBACK_MODELS), async (m) => {
    try {
      const res = await fetchWithRetry(VISION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.GEMINI_API_KEY}` },
        body: JSON.stringify({
          model: m, temperature: 0.1, response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: [{ type: "image_url", image_url: { url: dataUrl } }, { type: "text", text: "Εξήγαγε τα δεδομένα σε JSON." }] },
          ],
        }),
      }, { label: `vision:${m}` });
      if (!res.ok) { logGemini({ model: m, tokens: null, status: "FAILED" }); return { ok: false, error: new Error(`Vision ${res.status}: ${(await res.text()).slice(0, 200)}`) }; }
      const data = await res.json();
      const u = data?.usage ?? {};
      logGemini({ model: m, tokens: u.total_tokens ?? null });
      return { ok: true, value: { content: data?.choices?.[0]?.message?.content ?? "", tokens: u.total_tokens ?? null, model: m } };
    } catch (err) {
      logGemini({ model: m, tokens: null, status: "FAILED" });
      return { ok: false, error: err instanceof Error ? err : new Error(String(err)) };
    }
  });
}

async function callPdfNative(system: string, pdf: Buffer, model: string): Promise<{ content: string; tokens: number | null; model: string }> {
  const b64 = pdf.toString("base64");
  return tryModels(buildModelChain(model, FALLBACK_MODELS), async (m) => {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent?key=${env.GEMINI_API_KEY}`;
      const res = await fetchWithRetry(url, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ inline_data: { mime_type: "application/pdf", data: b64 } }, { text: "Εξήγαγε τα δεδομένα σε JSON." }] }],
          generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
        }),
      }, { label: `pdf:${m}` });
      if (!res.ok) { logGemini({ model: m, tokens: null, status: "FAILED" }); return { ok: false, error: new Error(`PDF ${res.status}: ${(await res.text()).slice(0, 200)}`) }; }
      const data = await res.json();
      const content = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).filter(Boolean).join("") ?? "";
      const u = data?.usageMetadata ?? {};
      logGemini({ model: m, tokens: u.totalTokenCount ?? null });
      return { ok: true, value: { content, tokens: u.totalTokenCount ?? null, model: m } };
    } catch (err) {
      logGemini({ model: m, tokens: null, status: "FAILED" });
      return { ok: false, error: err instanceof Error ? err : new Error(String(err)) };
    }
  });
}

export type ExtractOutput = { data: ExtractedDoc; rawText: string; model: string };

/** Extract structured data from an uploaded document buffer.
 *  PDFs go to Gemini's native PDF endpoint; images are enhanced then sent to vision.
 *  Auto-retries once with the pro model if too many required fields are missing. */
export async function extractDocument(args: { buffer: Buffer; mimeType: string; categoryCodes: string[] }): Promise<ExtractOutput> {
  const system = buildSystemPrompt(args.categoryCodes);
  const isPdf = args.mimeType === "application/pdf";

  const run = async (model: string) => {
    if (isPdf) return callPdfNative(system, args.buffer, model);
    const enhanced = await enhanceForOcr(args.buffer);
    const dataUrl = `data:${enhanced.mimeType};base64,${enhanced.buffer.toString("base64")}`;
    return callVision(system, dataUrl, model);
  };

  let res = await run(PRIMARY_MODEL);
  let parsed = ExtractedDocSchema.parse(parseJsonLoose(res.content));
  if (countMissingRequired(parsed) > RETRY_MISSING_THRESHOLD) {
    try {
      const retry = await run(UPGRADED_MODEL);
      const reparsed = ExtractedDocSchema.parse(parseJsonLoose(retry.content));
      if (countMissingRequired(reparsed) < countMissingRequired(parsed)) { res = retry; parsed = reparsed; }
    } catch { /* keep first result */ }
  }
  return { data: parsed, rawText: res.content, model: res.model };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run lib/ocr/extract.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/ocr/extract.ts lib/ocr/extract.test.ts package.json package-lock.json
git commit -m "feat(ocr): Gemini vision + PDF extraction engine"
```

---

## Task 9: DeepSeek normalization (`lib/ocr/normalize.ts`)

**Files:**
- Create: `lib/ocr/normalize.ts`
- Test: `lib/ocr/normalize.test.ts` (covers `computeConsumption` + `pickCategory` pure helpers)

- [ ] **Step 1: Write the failing test**

```ts
// lib/ocr/normalize.test.ts
import { describe, it, expect } from "vitest";
import { computeConsumption, pickCategory } from "./normalize";

describe("computeConsumption", () => {
  it("returns current - previous when both present and positive", () => {
    expect(computeConsumption(120, 100)).toBe(20);
  });
  it("returns null when a reading is missing", () => {
    expect(computeConsumption(null, 100)).toBeNull();
  });
  it("returns null on negative result (meter rollover/error)", () => {
    expect(computeConsumption(50, 100)).toBeNull();
  });
});

describe("pickCategory", () => {
  const codes = ["POWER", "WATER", "OTHER"];
  it("keeps a valid suggested code", () => {
    expect(pickCategory("WATER", codes)).toBe("WATER");
  });
  it("falls back to null for an unknown code", () => {
    expect(pickCategory("FOO", codes)).toBeNull();
  });
  it("returns null for null input", () => {
    expect(pickCategory(null, codes)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/ocr/normalize.test.ts`
Expected: FAIL — cannot find module `./normalize`.

- [ ] **Step 3: Write `normalize.ts`**

```ts
// lib/ocr/normalize.ts
import { env } from "@/lib/env";
import { fetchWithRetry } from "./fetch-retry";
import { logDeepSeek } from "./cost";
import { parseJsonLoose } from "./extract";
import { ExtractedDocSchema, type ExtractedDoc } from "./prompt";

export function computeConsumption(current: number | null, previous: number | null): number | null {
  if (current == null || previous == null) return null;
  const c = current - previous;
  return c >= 0 ? c : null;
}

export function pickCategory(code: string | null, validCodes: string[]): string | null {
  if (!code) return null;
  return validCodes.includes(code) ? code : null;
}

const DEEPSEEK_URL = process.env.DEEPSEEK_API_URL ?? "https://api.deepseek.com/v1/chat/completions";

/** Second pass: ask DeepSeek to clean/normalize the Gemini extraction, then apply
 *  deterministic fixes (consumption math, category validation). Falls back to the
 *  raw Gemini result if DeepSeek fails. */
export async function normalizeExtraction(doc: ExtractedDoc, rawText: string, validCodes: string[]): Promise<ExtractedDoc> {
  let result = doc;
  try {
    const res = await fetchWithRetry(DEEPSEEK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.DEEPSEEK_API_KEY}` },
      body: JSON.stringify({
        model: "deepseek-chat", temperature: 0.1, response_format: { type: "json_object" },
        messages: [
          { role: "system", content: `Καθάρισε και κανονικοποίησε τα εξαγμένα δεδομένα παραστατικού. Επίστρεψε το ίδιο JSON schema. Το suggestedCategoryCode πρέπει να είναι ένα από: ${validCodes.join(", ")} ή null. Ημερομηνίες σε YYYY-MM-DD, ποσά ως αριθμοί.` },
          { role: "user", content: JSON.stringify({ extracted: doc, rawText }) },
        ],
      }),
    });
    if (res.ok) {
      const data = await res.json();
      const u = data?.usage ?? {};
      logDeepSeek({ model: "deepseek-chat", tokens: u.total_tokens ?? null });
      result = ExtractedDocSchema.parse(parseJsonLoose(data?.choices?.[0]?.message?.content ?? ""));
    } else {
      logDeepSeek({ model: "deepseek-chat", tokens: null, status: "FAILED" });
    }
  } catch {
    logDeepSeek({ model: "deepseek-chat", tokens: null, status: "FAILED" });
  }

  result.suggestedCategoryCode = pickCategory(result.suggestedCategoryCode, validCodes);
  if (result.meter) {
    result.meter.consumption = result.meter.consumption ?? computeConsumption(result.meter.currentReading, result.meter.previousReading);
  }
  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/ocr/normalize.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/ocr/normalize.ts lib/ocr/normalize.test.ts
git commit -m "feat(ocr): DeepSeek normalization pass"
```

---

## Task 10: Expense-category server actions

**Files:**
- Create: `app/actions/expense-categories.ts`

- [ ] **Step 1: Write the actions**

```ts
// app/actions/expense-categories.ts
"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { canManageBuildingExpenses } from "@/lib/expenses/authz";
import { resolveSplit } from "@/lib/expenses/allocation";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const u = await db.user.findUnique({ where: { id: session.user.id as string }, select: { role: true } });
  if (!["SUPER_ADMIN", "ADMIN"].includes(u?.role ?? "")) throw new Error("Forbidden");
  return session.user.id as string;
}

export type CategoryInput = {
  name: string; code: string; utilityType: "NONE" | "POWER" | "WATER" | "GAS";
  defaultTenantPct: number; defaultOwnerPct: number; sortOrder?: number; active?: boolean;
};

function assertSplit(t: number, o: number) {
  if (t < 0 || o < 0 || t + o !== 100) throw new Error("Τα ποσοστά ενοικιαστή/ιδιοκτήτη πρέπει να αθροίζουν 100.");
}

export async function listExpenseCategories() {
  await auth();
  return db.expenseCategory.findMany({ orderBy: [{ active: "desc" }, { sortOrder: "asc" }] });
}

export async function createExpenseCategory(input: CategoryInput) {
  await requireAdmin();
  assertSplit(input.defaultTenantPct, input.defaultOwnerPct);
  const cat = await db.expenseCategory.create({ data: { ...input } });
  revalidatePath("/super-admin/settings/expense-categories");
  return cat;
}

export async function updateExpenseCategory(id: string, input: CategoryInput) {
  await requireAdmin();
  assertSplit(input.defaultTenantPct, input.defaultOwnerPct);
  const cat = await db.expenseCategory.update({ where: { id }, data: { ...input } });
  revalidatePath("/super-admin/settings/expense-categories");
  return cat;
}

export async function deleteExpenseCategory(id: string) {
  await requireAdmin();
  const used = await db.buildingExpense.count({ where: { categoryId: id } });
  if (used > 0) {
    await db.expenseCategory.update({ where: { id }, data: { active: false } }); // soft-disable
  } else {
    await db.expenseCategory.delete({ where: { id } });
  }
  revalidatePath("/super-admin/settings/expense-categories");
}

/** Categories with their effective split for a building (override applied). */
export async function getBuildingCategorySplits(buildingId: string) {
  const session = await auth();
  if (!session?.user || !(await canManageBuildingExpenses(session.user.id as string, buildingId))) throw new Error("Forbidden");
  const [cats, overrides] = await Promise.all([
    db.expenseCategory.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    db.buildingCategoryOverride.findMany({ where: { buildingId } }),
  ]);
  const byCat = new Map(overrides.map((o) => [o.categoryId, o]));
  return cats.map((c) => {
    const ov = byCat.get(c.id) ?? null;
    const split = resolveSplit(c, ov);
    return { category: c, override: ov, effective: split, isOverridden: !!ov };
  });
}

export async function upsertBuildingCategoryOverride(buildingId: string, categoryId: string, tenantPct: number, ownerPct: number) {
  const session = await auth();
  if (!session?.user || !(await canManageBuildingExpenses(session.user.id as string, buildingId))) throw new Error("Forbidden");
  assertSplit(tenantPct, ownerPct);
  await db.buildingCategoryOverride.upsert({
    where: { buildingId_categoryId: { buildingId, categoryId } },
    update: { tenantPct, ownerPct },
    create: { buildingId, categoryId, tenantPct, ownerPct },
  });
  revalidatePath(`/super-admin/buildings/${buildingId}`);
}

export async function clearBuildingCategoryOverride(buildingId: string, categoryId: string) {
  const session = await auth();
  if (!session?.user || !(await canManageBuildingExpenses(session.user.id as string, buildingId))) throw new Error("Forbidden");
  await db.buildingCategoryOverride.deleteMany({ where: { buildingId, categoryId } });
  revalidatePath(`/super-admin/buildings/${buildingId}`);
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors. (Confirm the `buildingId_categoryId` compound unique name matches Prisma's generated input — it derives from `@@unique([buildingId, categoryId])`.)

- [ ] **Step 3: Commit**

```bash
git add app/actions/expense-categories.ts
git commit -m "feat(expenses): category CRUD + per-building split override actions"
```

---

## Task 11: Building-expense server actions (upload, extract, register)

**Files:**
- Create: `app/actions/building-expenses.ts`

- [ ] **Step 1: Write the actions**

```ts
// app/actions/building-expenses.ts
"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { uploadFile, buildingFolder } from "@/lib/bunnycdn";
import { canManageBuildingExpenses } from "@/lib/expenses/authz";
import { computeAllocation, type AllocUnit } from "@/lib/expenses/allocation";
import { extractDocument } from "@/lib/ocr/extract";
import { normalizeExtraction } from "@/lib/ocr/normalize";
import type { ExtractedDoc } from "@/lib/ocr/prompt";

const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

async function requireBuildingAccess(buildingId: string): Promise<string> {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const uid = session.user.id as string;
  if (!(await canManageBuildingExpenses(uid, buildingId))) throw new Error("Forbidden");
  return uid;
}

/** Upload the document to BunnyCDN, OCR-extract it, return data for the review modal.
 *  No BuildingExpense is created here. */
export async function extractExpenseDocument(buildingId: string, formData: FormData): Promise<{ fileId: string; fileUrl: string; extracted: ExtractedDoc }> {
  const uid = await requireBuildingAccess(buildingId);
  const file = formData.get("file") as File | null;
  if (!file) throw new Error("Δεν δόθηκε αρχείο.");
  if (file.size > MAX_BYTES) throw new Error("Το αρχείο ξεπερνά τα 15MB.");
  if (!ALLOWED.includes(file.type)) throw new Error("Μη υποστηριζόμενος τύπος αρχείου.");

  const building = await db.building.findUnique({ where: { id: buildingId }, select: { propertyId: true } });
  if (!building) throw new Error("Δεν βρέθηκε κτήριο.");

  const buffer = Buffer.from(await file.arrayBuffer());
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${buildingFolder(building.propertyId, buildingId)}/expenses/${Date.now()}-${safeName}`;
  const up = await uploadFile({ path, buffer, contentType: file.type });
  if (!up.success || !up.url) throw new Error(up.error ?? "Αποτυχία ανεβάσματος.");

  const bf = await db.buildingFile.create({
    data: { buildingId, category: "RECEIPT", name: file.name, cdnPath: path, url: up.url, mimeType: file.type, sizeBytes: buffer.length, uploadedById: uid },
  });

  const codes = (await db.expenseCategory.findMany({ where: { active: true }, select: { code: true } })).map((c) => c.code);
  let extracted: ExtractedDoc;
  try {
    const out = await extractDocument({ buffer, mimeType: file.type, categoryCodes: codes });
    extracted = await normalizeExtraction(out.data, out.rawText, codes);
  } catch {
    // OCR failed entirely — return an empty shell so the modal opens for manual entry.
    extracted = { docType: "other", supplierName: null, supplierVat: null, supplierDoy: null, documentNumber: null, documentDate: null, netAmount: null, vatAmount: null, totalAmount: null, suggestedCategoryCode: null, meter: null, confidence: 0 };
  }
  return { fileId: bf.id, fileUrl: up.url, extracted };
}

type UnitForAlloc = { id: string; millesimes: number | null; ownerId: string | null; residentId: string | null; occupancies: { userId: string; role: "OWNER" | "RESIDENT" }[] };

async function loadAllocUnits(buildingId: string): Promise<AllocUnit[]> {
  const units = await db.unit.findMany({
    where: { buildingId },
    select: { id: true, millesimes: true, ownerId: true, residentId: true,
      occupancies: { where: { endDate: null }, select: { userId: true, role: true } } },
  }) as unknown as UnitForAlloc[];
  return units.map((u) => {
    const owner = u.occupancies.find((o) => o.role === "OWNER")?.userId ?? u.ownerId ?? null;
    const tenant = u.occupancies.find((o) => o.role === "RESIDENT")?.userId ?? u.residentId ?? null;
    return { unitId: u.id, millesimes: u.millesimes, ownerUserId: owner, tenantUserId: tenant };
  });
}

export async function previewExpenseAllocation(buildingId: string, args: { total: number; tenantPct: number; ownerPct: number }) {
  await requireBuildingAccess(buildingId);
  const units = await loadAllocUnits(buildingId);
  return computeAllocation({ total: args.total, tenantPct: args.tenantPct, ownerPct: args.ownerPct, units });
}

export type CreateExpenseInput = {
  fileId: string | null;
  categoryId: string | null;
  month: string;              // YYYY-MM
  supplierName?: string | null; supplierVat?: string | null;
  documentNumber?: string | null; documentDate?: string | null;
  netAmount?: number | null; vatAmount?: number | null; totalAmount: number;
  description?: string | null;
  tenantPct: number; ownerPct: number;
  ocrRaw?: any; ocrConfidence?: number | null;
  meter?: { meterType: "POWER" | "WATER" | "GAS"; meterNumber?: string | null; unit?: string | null; periodFrom?: string | null; periodTo?: string | null; previousReading?: number | null; currentReading?: number | null; consumption?: number | null } | null;
};

export async function createBuildingExpense(buildingId: string, input: CreateExpenseInput) {
  await requireBuildingAccess(buildingId);
  const units = await loadAllocUnits(buildingId);
  const rows = computeAllocation({ total: input.totalAmount, tenantPct: input.tenantPct, ownerPct: input.ownerPct, units });

  const expense = await db.$transaction(async (tx) => {
    const exp = await tx.buildingExpense.create({
      data: {
        buildingId, month: input.month, categoryId: input.categoryId, receiptFileId: input.fileId,
        amount: input.totalAmount, netAmount: input.netAmount ?? null, vatAmount: input.vatAmount ?? null,
        supplierName: input.supplierName ?? null, supplierVat: input.supplierVat ?? null,
        documentNumber: input.documentNumber ?? null,
        documentDate: input.documentDate ? new Date(input.documentDate) : null,
        description: input.description ?? null, status: "CONFIRMED",
        tenantPct: input.tenantPct, ownerPct: input.ownerPct,
        ocrRaw: input.ocrRaw ?? undefined, ocrConfidence: input.ocrConfidence ?? null,
      },
    });
    if (input.meter && input.meter.meterType) {
      await tx.meterReading.create({
        data: {
          buildingId, expenseId: exp.id, meterType: input.meter.meterType, meterNumber: input.meter.meterNumber ?? null,
          unit: input.meter.unit ?? null,
          periodFrom: input.meter.periodFrom ? new Date(input.meter.periodFrom) : null,
          periodTo: input.meter.periodTo ? new Date(input.meter.periodTo) : null,
          previousReading: input.meter.previousReading ?? null, currentReading: input.meter.currentReading ?? null,
          consumption: input.meter.consumption ?? null,
        },
      });
    }
    if (rows.length) {
      await tx.expenseAllocation.createMany({
        data: rows.map((r) => ({ expenseId: exp.id, unitId: r.unitId, unitShare: r.unitShare, tenantUserId: r.tenantUserId, tenantAmount: r.tenantAmount, ownerUserId: r.ownerUserId, ownerAmount: r.ownerAmount })),
      });
    }
    return exp;
  });

  revalidatePath(`/super-admin/buildings/${buildingId}`);
  return expense;
}

export async function listBuildingExpenses(buildingId: string) {
  await requireBuildingAccess(buildingId);
  return db.buildingExpense.findMany({
    where: { buildingId },
    orderBy: [{ documentDate: "desc" }, { createdAt: "desc" }],
    include: { categoryRef: true, receiptFile: true, _count: { select: { allocations: true } } },
  });
}

export async function deleteBuildingExpense(id: string) {
  const exp = await db.buildingExpense.findUnique({ where: { id }, select: { buildingId: true } });
  if (!exp) return;
  await requireBuildingAccess(exp.buildingId);
  await db.buildingExpense.delete({ where: { id } });
  revalidatePath(`/super-admin/buildings/${exp.buildingId}`);
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add app/actions/building-expenses.ts
git commit -m "feat(expenses): upload+OCR extract, allocation preview, register/list/delete actions"
```

---

## Task 12: ExpenseCategory admin page

**Files:**
- Create: `app/(dashboard)/super-admin/settings/expense-categories/page.tsx`
- Create: `app/(dashboard)/super-admin/settings/expense-categories/expense-categories-client.tsx`

- [ ] **Step 1: Read the existing settings page pattern**

Open `app/(dashboard)/super-admin/settings/costs/page.tsx` and mirror its server-component
structure (auth guard, fetch, render a client component). Match the existing layout
wrappers/heading components used there.

- [ ] **Step 2: Write `page.tsx`**

```tsx
import { listExpenseCategories } from "@/app/actions/expense-categories";
import { ExpenseCategoriesClient } from "./expense-categories-client";

export default async function ExpenseCategoriesPage() {
  const categories = await listExpenseCategories();
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Κατηγορίες Εξόδων</h1>
      <ExpenseCategoriesClient initial={categories} />
    </div>
  );
}
```

- [ ] **Step 3: Write `expense-categories-client.tsx`**

A `"use client"` component with: a table of categories (name, code, utilityType,
default split as `tenant% / owner%`, active), an "Προσθήκη" button opening a dialog
with fields {name, code, utilityType select, defaultTenantPct number}, computing
`defaultOwnerPct = 100 - defaultTenantPct`, calling `createExpenseCategory` /
`updateExpenseCategory`, and a delete button calling `deleteExpenseCategory` then
`router.refresh()`. Use existing shadcn `Dialog`, `Input`, `Select`, `Button`,
`Table` components already in `components/ui/`. Linear `react-icons/ri` icons only.

Reference component to copy structure/imports from: the client in
`app/(dashboard)/super-admin/settings/costs/`.

- [ ] **Step 4: Verify it renders**

Run: `npm run dev` and open `/super-admin/settings/expense-categories`.
Expected: table lists the 11 seeded categories; add/edit/delete work.

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/super-admin/settings/expense-categories"
git commit -m "feat(expenses): ExpenseCategory admin CRUD page"
```

---

## Task 13: Building page — ExpensesPanel + OCR upload + review modal

**Files:**
- Create: `components/buildings/ExpensesPanel.tsx`, `ExpenseOcrUpload.tsx`, `ExpenseReviewForm.tsx`
- Modify: `app/(dashboard)/super-admin/buildings/[id]/page.tsx`

- [ ] **Step 1: Read how `FilesPanel` is built and mounted**

Open `app/(dashboard)/super-admin/buildings/[id]/FilesPanel.tsx` and the building
`page.tsx` to copy the panel pattern (props, data passed, where panels are mounted,
how server data is fetched/passed to client panels).

- [ ] **Step 2: Write `ExpenseOcrUpload.tsx`** (`"use client"`)

A button "Καταχώρηση εξόδου (OCR)" that opens a dialog with a native drag-drop area +
`<input type="file" accept="image/*,application/pdf">`. On file selected: build a
`FormData` (`file`), call `extractExpenseDocument(buildingId, fd)` showing a spinner,
then render `ExpenseReviewForm` with the returned `{ fileId, fileUrl, extracted }`.
No external dropzone dependency — use `onDragOver`/`onDrop` handlers.

- [ ] **Step 3: Write `ExpenseReviewForm.tsx`** (`"use client"`)

Props: `{ buildingId, fileId, fileUrl, extracted, categories, onDone }` where
`categories` is the `getBuildingCategorySplits(buildingId)` result.
Renders:
- File preview: `<img>` if image URL, else `<iframe src={fileUrl}>` for PDF.
- Fields: supplierName, supplierVat, documentNumber, documentDate (date input),
  netAmount, vatAmount, totalAmount (number inputs), month (defaults from
  documentDate `YYYY-MM`), description.
- Category `<Select>` from `categories`. On change, set `tenantPct/ownerPct` from
  that category's `effective` split.
- Tenant/owner split: a number input for `tenantPct` (0–100); `ownerPct = 100 -
  tenantPct` shown read-only.
- If the selected category's `utilityType !== "NONE"`, show meter fields
  (meterNumber, previousReading, currentReading, consumption auto = current −
  previous, unit, periodFrom, periodTo).
- Confidence badge from `extracted.confidence`.
- An allocation preview: on amount/split change (debounced), call
  `previewExpenseAllocation(buildingId, { total, tenantPct, ownerPct })` and render a
  table (unit, χιλιοστά share, tenantAmount, ownerAmount); rows with
  `missingMillesimes` get a warning badge.
- "Καταχώρηση" button → `createBuildingExpense(buildingId, input)` (include
  `ocrRaw: extracted`, `ocrConfidence`), then `onDone()` + `router.refresh()`.

- [ ] **Step 4: Write `ExpensesPanel.tsx`** (`"use client"`)

Props `{ buildingId, expenses, categories }`. Renders the `ExpenseOcrUpload` button +
a `DataTable` (from `components/ui/data-table.tsx`) with columns: documentDate,
supplierName, category name, netAmount, vatAmount, amount (total), status, a receipt
link (`receiptFile?.url`), and a delete row-action calling `deleteBuildingExpense`.
Follow the `feedback_data_table_standard` (the shared `DataTable` component).

- [ ] **Step 5: Mount in building `page.tsx`**

Fetch `listBuildingExpenses(id)` and `getBuildingCategorySplits(id)` in the server
component and render `<ExpensesPanel buildingId={id} expenses={...} categories={...} />`
in a new "Έξοδα" tab/section alongside the existing panels, matching how `FilesPanel`
is mounted.

- [ ] **Step 6: Manual verification**

Run: `npm run dev`, open a building, click "Καταχώρηση εξόδου (OCR)", upload a sample
ΔΕΗ/receipt image or PDF. Expected: fields pre-fill, category auto-selected, split
defaults applied, allocation preview sums to the total, "Καταχώρηση" creates the row
and it appears in the table with a working receipt link.

- [ ] **Step 7: Commit**

```bash
git add components/buildings/ExpensesPanel.tsx components/buildings/ExpenseOcrUpload.tsx components/buildings/ExpenseReviewForm.tsx "app/(dashboard)/super-admin/buildings/[id]/page.tsx"
git commit -m "feat(expenses): building Έξοδα panel — OCR upload, review modal, list"
```

---

## Task 14: Per-building split settings UI

**Files:**
- Create: `components/buildings/CategorySplitSettings.tsx`
- Modify: `app/(dashboard)/super-admin/buildings/[id]/page.tsx`

- [ ] **Step 1: Write `CategorySplitSettings.tsx`** (`"use client"`)

Props `{ buildingId, rows }` where `rows` is `getBuildingCategorySplits(buildingId)`.
Render a table: category name, effective `tenant% / owner%`, a badge
"override"/"default", and inline edit (number input for tenantPct, owner computed) with
"Αποθήκευση" → `upsertBuildingCategoryOverride` and, when overridden, "Επαναφορά" →
`clearBuildingCategoryOverride`. `router.refresh()` after each.

- [ ] **Step 2: Mount it** in the building `page.tsx` under a "Ρυθμίσεις κατανομής"
section, passing the already-fetched `getBuildingCategorySplits(id)` result (reuse the
same fetch from Task 13).

- [ ] **Step 3: Manual verification**

Run: `npm run dev`. Change a category's split for one building, reopen the expense
review modal, pick that category → the split defaults to the overridden value. Reset
restores the category default.

- [ ] **Step 4: Commit**

```bash
git add components/buildings/CategorySplitSettings.tsx "app/(dashboard)/super-admin/buildings/[id]/page.tsx"
git commit -m "feat(expenses): per-building category split settings UI"
```

---

## Task 15: Full test + typecheck sweep

- [ ] **Step 1: Run all unit tests**

Run: `npx vitest run`
Expected: all expense/OCR tests pass (authz 4, allocation 4, model-fallback 3, extract 4, normalize 6).

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no new errors in the new files.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Final commit (if any fixes were needed)**

```bash
git add -A
git commit -m "chore(expenses): test + typecheck sweep fixes"
```

---

## Notes for the executor

- **Encoding/SoftOne are NOT involved** here — these are Gemini/DeepSeek OpenAI-compatible JSON APIs, not SoftOne. Do not apply the win1253 decoding rule.
- Keep the legacy `BuildingExpense.category String?` field untouched; new code uses `categoryId`.
- All money math uses 2-decimal rounding; the allocation helper guarantees the per-unit shares sum to the total exactly.
- If `npm run lint` flags `any` in the action/engine files, prefer narrow types but do not block the feature on exhaustive typing of third-party JSON responses.
