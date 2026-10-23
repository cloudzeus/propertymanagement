import { describe, it, expect } from "vitest";
import { lineFor, packageTotal, type PkgCounts } from "./package";

const c: PkgCounts = { units: 5, buildings: 1, commonAreas: 2 };

describe("lineFor", () => {
  it("PER_UNIT 5 units × 3 € = 15 €", () => {
    expect(lineFor({ pricingModel: "PER_UNIT", price: 3 }, c)).toEqual({ qty: 5, amount: 15, detail: null });
  });
  it("PER_BUILDING, PER_COMMON_AREA and FLAT use their own count", () => {
    expect(lineFor({ pricingModel: "PER_BUILDING", price: 40 }, c).amount).toBe(40);
    expect(lineFor({ pricingModel: "PER_COMMON_AREA", price: 15 }, c)).toEqual({ qty: 2, amount: 30, detail: null });
    expect(lineFor({ pricingModel: "FLAT", price: 99.5 }, c)).toEqual({ qty: 1, amount: 99.5, detail: null });
  });
  it("PER_ZONE sums the zone prices of the given codes on top of the base price", () => {
    const s = { pricingModel: "PER_ZONE", price: 10, zonePrices: { A: 5, B: 12 } };
    expect(lineFor(s, { ...c, buildings: 3 }, ["A", "B", null])).toEqual({ qty: 1, amount: 27, detail: "βάση 10,00 € + ζώνες 17,00 € (1 κτήριο χωρίς απόσταση)" });
    expect(lineFor(s, c)).toEqual({ qty: 1, amount: 10, detail: "από τη βασική τιμή· το ποσό ζώνης προστίθεται όταν ενεργοποιηθεί" });
  });
  it("METERED_PREPAID has qty null and amount 0", () => {
    expect(lineFor({ pricingModel: "METERED_PREPAID", price: 1 }, c)).toEqual({ qty: null, amount: 0, detail: "προπληρωμένα λεπτά συνελεύσεων" });
  });
  it("rounds to cents", () => {
    expect(lineFor({ pricingModel: "PER_UNIT", price: 3.333 }, c).amount).toBe(16.67);
  });
});

describe("packageTotal", () => {
  it("sums enabled lines only", () => {
    const total = packageTotal([
      { pricingModel: "PER_UNIT", price: 3, enabled: true },
      { pricingModel: "FLAT", price: 50, enabled: false },
      { pricingModel: "PER_COMMON_AREA", price: 15, enabled: true },
    ], c);
    expect(total).toBe(45);
  });
  it("is 0 with nothing enabled", () => {
    expect(packageTotal([{ pricingModel: "FLAT", price: 50, enabled: false }], c)).toBe(0);
  });
});
