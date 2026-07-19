import { describe, it, expect } from "vitest";
import { serviceLineAmount, computePackageTotal } from "./service-amount";

const svc = (o: Partial<{ id: string; name: string; pricingModel: string; price: number }>) =>
  ({ id: "s", name: "Svc", pricingModel: "FLAT", price: 10, ...o }) as any;
const counts = { units: 4, buildings: 2, commonAreas: 3 };

describe("serviceLineAmount", () => {
  it("multiplies by the right count", () => {
    expect(serviceLineAmount(svc({ pricingModel: "PER_UNIT", price: 2 }), counts)).toBe(8);
    expect(serviceLineAmount(svc({ pricingModel: "PER_BUILDING", price: 5 }), counts)).toBe(10);
    expect(serviceLineAmount(svc({ pricingModel: "PER_COMMON_AREA", price: 3 }), counts)).toBe(9);
    expect(serviceLineAmount(svc({ pricingModel: "FLAT", price: 12 }), counts)).toBe(12);
    expect(serviceLineAmount(svc({ pricingModel: "METERED_PREPAID", price: 99 }), counts)).toBe(0);
  });
});
describe("computePackageTotal", () => {
  it("sums lines and totals cents", () => {
    const r = computePackageTotal([svc({ id: "a", pricingModel: "PER_UNIT", price: 2 }), svc({ id: "b", pricingModel: "FLAT", price: 12 })], counts);
    expect(r.totalCents).toBe(2000);
    expect(r.lines.map((l) => l.amount)).toEqual([8, 12]);
  });
});
