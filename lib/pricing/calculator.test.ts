import { describe, it, expect } from "vitest";
import { calculate, CALC_DEFAULTS, formatEuro, sliderPercent } from "./calculator";

const base = {
  buildings: CALC_DEFAULTS.buildings,
  apartmentsPerBuilding: CALC_DEFAULTS.apartmentsPerBuilding,
  plan: CALC_DEFAULTS.plan,
  annual: CALC_DEFAULTS.annual,
  addons: CALC_DEFAULTS.addons,
};

describe("cost calculator", () => {
  /**
   * Handoff 04 §1 claims the defaults land on €2.04/apt and "€2,285/month".
   * Both are wrong against its own formula: 14 × €2.20 = €30.80 is under the
   * €32 Standard floor, so the per-building minimum binds. €2.04 is what you
   * get with the floor ignored (€285.60 × 0.8 / 112), and €2,285 is that same
   * number a decimal place out. The formula and its worked example ("a
   * 4-apartment building on Standard costs €32, not €8.80") are stated as the
   * rule, so the formula wins and the defaults land here instead.
   */
  it("lands on the formula's figures for the defaults", () => {
    const r = calculate(base);
    expect(r.totalApartments).toBe(112);
    expect(r.minApplied).toBe(true);
    // 8 × €32 floor = €256 + 112 × €0.35 = €295.20 gross → ×0.8 annual
    expect(r.grossMonthly).toBeCloseTo(295.2, 6);
    expect(Math.round(r.monthly)).toBe(236);
    expect(r.perApartment.toFixed(2)).toBe("2.11");
  });

  it("applies the minimum per building, not per portfolio", () => {
    const r = calculate({ ...base, apartmentsPerBuilding: 4, addons: [] });
    expect(r.minApplied).toBe(true);
    // 8 buildings × €32 floor, not 8 × 4 × €2.20
    expect(r.grossMonthly).toBe(256);
  });

  it("derives the yearly saving from the gross figure on either cycle", () => {
    const annual = calculate({ ...base, annual: true });
    const monthly = calculate({ ...base, annual: false });
    expect(annual.yearlySaving).toBeCloseTo(monthly.yearlySaving, 6);
    expect(annual.monthly).toBeCloseTo(monthly.monthly * 0.8, 6);
  });

  it("reports no add-ons rather than a zero rate", () => {
    expect(calculate({ ...base, addons: [] }).addonCount).toBe(0);
  });

  it("formats Greek figures with comma decimals", () => {
    expect(formatEuro(2.04, "el", 2)).toBe("€2,04");
    expect(formatEuro(2285, "en", 0)).toBe("€2,285");
  });

  it("maps slider values onto the track", () => {
    expect(sliderPercent(1, 1, 120)).toBe(0);
    expect(sliderPercent(120, 1, 120)).toBe(100);
  });
});
