import { describe, it, expect } from "vitest";
import { groupAllocationsByMonth, duoTrend, type AllocRow } from "./alloc-view";

const rows: AllocRow[] = [
  { id: "a", month: "2026-07", unitLabel: "A1", description: "Κοινόχρηστα", amount: 40, paid: false, receiptUrl: null },
  { id: "b", month: "2026-07", unitLabel: "B2", description: null, amount: 10, paid: true, receiptUrl: null },
  { id: "c", month: "2026-06", unitLabel: "A1", description: null, amount: 25, paid: true, receiptUrl: "u" },
];

describe("groupAllocationsByMonth", () => {
  it("groups by month desc with per-month and grand totals", () => {
    const g = groupAllocationsByMonth(rows);
    expect(g.months.map((m) => m.month)).toEqual(["2026-07", "2026-06"]);
    expect(g.months[0].total).toBe(50);
    expect(g.months[0].unpaid).toBe(40);
    expect(g.totalUnpaid).toBe(40);
    expect(g.total).toBe(75);
  });
  it("handles empty input", () => {
    const g = groupAllocationsByMonth([]);
    expect(g.months).toEqual([]);
    expect(g.total).toBe(0);
    expect(g.totalUnpaid).toBe(0);
  });
});

describe("duoTrend", () => {
  const months = ["2026-05", "2026-06", "2026-07"];
  it("aligns owner/tenant sums to the month window with zeros", () => {
    const t = duoTrend(
      [
        { month: "2026-07", owner: 30, tenant: 0 },
        { month: "2026-07", owner: 10, tenant: 5 },
        { month: "2026-04", owner: 99, tenant: 99 },
      ],
      months,
    );
    expect(t).toEqual([
      { month: "2026-05", owner: 0, tenant: 0 },
      { month: "2026-06", owner: 0, tenant: 0 },
      { month: "2026-07", owner: 40, tenant: 5 },
    ]);
  });
  it("empty rows → all zero", () => {
    expect(duoTrend([], ["2026-07"])).toEqual([{ month: "2026-07", owner: 0, tenant: 0 }]);
  });
});
