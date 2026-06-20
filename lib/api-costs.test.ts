import { describe, it, expect } from "vitest";
import { DEFAULT_API_COSTS } from "./api-costs";
import { getBilledCost } from "./api-costs";

describe("getBilledCost", () => {
  it("returns real cost unchanged at 0% markup", () => {
    expect(getBilledCost(10, 0)).toBe(10);
  });
  it("applies a percentage markup", () => {
    expect(getBilledCost(10, 30)).toBeCloseTo(13, 6);
  });
  it("handles fractional costs and markup", () => {
    expect(getBilledCost(0.0005, 50)).toBeCloseTo(0.00075, 8);
  });
  it("treats missing/NaN markup as 0", () => {
    expect(getBilledCost(10, NaN)).toBe(10);
  });
});

describe("DEFAULT_API_COSTS", () => {
  it("has per-minute pricing for daily and deepgram", () => {
    expect(DEFAULT_API_COSTS.daily.costModel).toBe("per_minute");
    expect(DEFAULT_API_COSTS.deepgram.costModel).toBe("per_minute");
    expect(typeof DEFAULT_API_COSTS.daily.basePrice).toBe("number");
    expect(typeof DEFAULT_API_COSTS.deepgram.basePrice).toBe("number");
  });
});
