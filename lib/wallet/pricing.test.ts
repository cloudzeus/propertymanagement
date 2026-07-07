import { describe, it, expect } from "vitest";
import { computeRealCost, computeCharges } from "./pricing";

describe("computeRealCost", () => {
  it("per_token uses tokens/1000 × basePrice", () => {
    expect(computeRealCost({ costModel: "per_token", basePrice: 0.001, freeQuota: 0 }, { tokensUsed: 15000 })).toBeCloseTo(0.015, 9);
  });
  it("per_minute uses minutes × basePrice", () => {
    expect(computeRealCost({ costModel: "per_minute", basePrice: 0.05, freeQuota: 0 }, { minutes: 30 })).toBeCloseTo(1.5, 9);
  });
  it("per_gb subtracts free quota", () => {
    const gb2 = 2 * 1024 * 1024 * 1024;
    expect(computeRealCost({ costModel: "per_gb", basePrice: 0.01, freeQuota: 1 }, { bytesProcessed: gb2 })).toBeCloseTo(0.01, 9);
  });
  it("per_request/per_email uses requestCount × basePrice", () => {
    expect(computeRealCost({ costModel: "per_email", basePrice: 0.002, freeQuota: 0 }, { requestCount: 5 })).toBeCloseTo(0.01, 9);
  });
});

describe("computeCharges", () => {
  it("applies markup#1 for billed and markup#2 for customer charge", () => {
    const r = computeCharges(1.0, 20, 50);
    expect(r.billedCostEur).toBeCloseTo(1.2, 9);
    expect(r.customerChargeEur).toBeCloseTo(1.8, 9);
  });
  it("zero markups pass through", () => {
    const r = computeCharges(2.0, 0, 0);
    expect(r.billedCostEur).toBe(2);
    expect(r.customerChargeEur).toBe(2);
  });
});
