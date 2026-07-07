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
  creditWallet: vi.fn(async (i: any) => { calls.push(i); return { balanceAfter: 0 }; }),
  applyLedgerEntry: vi.fn(),
  getWalletBalance: vi.fn(async () => 3),
}));
import { runMonthlyAllowance } from "./allowance";
import { getWalletBalance } from "./ledger";

beforeEach(() => { calls.length = 0; vi.clearAllMocks(); (getWalletBalance as any).mockResolvedValue(3); });

describe("runMonthlyAllowance", () => {
  it("zeroes then re-grants the allowance for non-rollover wallets (two entries)", async () => {
    await runMonthlyAllowance();
    const c1 = calls.filter((c) => c.ownerId === "c1");
    expect(c1[0].type).toBe("RESET");
    expect(c1[0].amountEur).toBeCloseTo(-3, 9);
    expect(c1[1].type).toBe("ALLOWANCE");
    expect(c1[1].amountEur).toBeCloseTo(10, 9);
  });
  it("adds allowance on top for rollover wallets (single entry)", async () => {
    await runMonthlyAllowance();
    const c2 = calls.filter((c) => c.ownerId === "c2");
    expect(c2).toHaveLength(1);
    expect(c2[0].type).toBe("ALLOWANCE");
    expect(c2[0].amountEur).toBeCloseTo(5, 9);
  });
});
