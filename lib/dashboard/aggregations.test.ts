import { describe, it, expect } from "vitest";
import { formatEuro, occupancy, sumUnpaid, collectionRate, monthlyTrend, lastNMonths } from "./aggregations";

describe("formatEuro", () => {
  it("formats with euro sign and 2 decimals", () => {
    expect(formatEuro(1234.5)).toBe("€1.234,50");
    expect(formatEuro(0)).toBe("€0,00");
  });
});

describe("occupancy", () => {
  it("counts occupied/vacant and rate", () => {
    const r = occupancy([{ residentId: "a" }, { residentId: null }, { residentId: "b" }]);
    expect(r).toEqual({ total: 3, occupied: 2, vacant: 1, rate: 67 });
  });
  it("handles empty", () => {
    expect(occupancy([])).toEqual({ total: 0, occupied: 0, vacant: 0, rate: 0 });
  });
});

describe("sumUnpaid", () => {
  it("sums amount where paid flag is false", () => {
    const rows = [{ amount: 10, paid: false }, { amount: 5, paid: true }, { amount: 7.5, paid: false }];
    expect(sumUnpaid(rows)).toBe(17.5);
  });
});

describe("collectionRate", () => {
  it("returns collected/total and pct", () => {
    expect(collectionRate(75, 100)).toEqual({ collected: 75, total: 100, pct: 75 });
  });
  it("guards divide-by-zero", () => {
    expect(collectionRate(0, 0)).toEqual({ collected: 0, total: 0, pct: 0 });
  });
});

describe("lastNMonths", () => {
  it("returns N YYYY-MM keys ending at anchor, oldest first", () => {
    expect(lastNMonths("2026-03", 3)).toEqual(["2026-01", "2026-02", "2026-03"]);
    expect(lastNMonths("2026-01", 2)).toEqual(["2025-12", "2026-01"]);
  });
});

describe("monthlyTrend", () => {
  it("buckets amounts into the month series, zero-filling gaps", () => {
    const rows = [{ month: "2026-02", amount: 10 }, { month: "2026-02", amount: 5 }, { month: "2026-03", amount: 8 }];
    expect(monthlyTrend(rows, ["2026-01", "2026-02", "2026-03"])).toEqual([
      { month: "2026-01", value: 0 }, { month: "2026-02", value: 15 }, { month: "2026-03", value: 8 },
    ]);
  });
});
