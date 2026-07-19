import { describe, it, expect } from "vitest";
import { selectUnpaidForSide, type AllocForPay } from "./koinochrista-pay";

const a = (o: Partial<AllocForPay>): AllocForPay => ({
  id: "x", ownerUserId: "u", ownerAmount: 0, ownerPaid: false,
  tenantUserId: null, tenantAmount: 0, tenantPaid: false, ...o,
});

describe("selectUnpaidForSide", () => {
  it("owner side: sums unpaid owner amounts for the user, skips paid and other users", () => {
    const r = selectUnpaidForSide([
      a({ id: "1", ownerUserId: "me", ownerAmount: 10, ownerPaid: false }),
      a({ id: "2", ownerUserId: "me", ownerAmount: 5, ownerPaid: true }),   // paid → skip
      a({ id: "3", ownerUserId: "other", ownerAmount: 9, ownerPaid: false }), // other → skip
    ], "me");
    expect(r.amountCents).toBe(1000);
    expect(r.owner).toEqual(["1"]);
    expect(r.tenant).toEqual([]);
  });
  it("tenant side + both: sums both sides where the user is that side", () => {
    const r = selectUnpaidForSide([
      a({ id: "1", ownerUserId: "me", ownerAmount: 20, ownerPaid: false, tenantUserId: "me", tenantAmount: 3, tenantPaid: false }),
    ], "me");
    expect(r.amountCents).toBe(2300);
    expect(r.owner).toEqual(["1"]);
    expect(r.tenant).toEqual(["1"]);
  });
});
