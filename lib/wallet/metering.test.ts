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
  (getConfig as any).mockResolvedValue({ apiName: "deepseek", displayName: "Deepseek", costModel: "per_token", basePrice: 0.001, freeQuota: 0, markupPercent: 20 });
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
