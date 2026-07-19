import { describe, it, expect } from "vitest";
import { groupRowsByUnit, type PaymentRowLike } from "./payment-statements";

const r = (o: Partial<PaymentRowLike>): PaymentRowLike => ({
  id: "x", unitId: "u1", buildingId: "b", buildingName: "B", unitNumber: "1", floor: 1,
  month: "2026-06", myAmount: 0, myPaid: true, ...o,
});

describe("groupRowsByUnit", () => {
  it("one row per unit; sums outstanding (unpaid myAmount) and total", () => {
    const g = groupRowsByUnit([
      r({ id: "a", unitId: "u1", month: "2026-06", myAmount: 0, myPaid: true }),
      r({ id: "b", unitId: "u1", month: "2025-04", myAmount: 156.23, myPaid: false }),
      r({ id: "c", unitId: "u2", month: "2026-06", myAmount: 47.55, myPaid: false }),
    ]);
    expect(g.length).toBe(2);
    const u1 = g.find((x) => x.unitId === "u1")!;
    expect(u1.outstanding).toBe(156.23);
    expect(u1.total).toBe(156.23);
    expect(u1.months.length).toBe(2);
    expect(g.find((x) => x.unitId === "u2")!.outstanding).toBe(47.55);
  });

  it("paid when no unpaid rows; months sorted newest first", () => {
    const g = groupRowsByUnit([
      r({ id: "a", unitId: "u1", month: "2025-04", myAmount: 10, myPaid: true }),
      r({ id: "b", unitId: "u1", month: "2026-06", myAmount: 20, myPaid: true }),
    ]);
    expect(g.length).toBe(1);
    expect(g[0].paid).toBe(true);
    expect(g[0].outstanding).toBe(0);
    expect(g[0].total).toBe(30);
    expect(g[0].months.map((m) => m.month)).toEqual(["2026-06", "2025-04"]);
  });
});
