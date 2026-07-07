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
