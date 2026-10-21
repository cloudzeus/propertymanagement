import { describe, it, expect } from "vitest";
import { serviceLineAmount, computePackageTotal } from "./service-amount";
import { DEFAULT_ZONES } from "@/lib/distance/zones";

const svc = (o: Partial<{ id: string; name: string; pricingModel: string; price: number; zonePrices: Record<string, number> | null }>) =>
  ({ id: "s", name: "Svc", pricingModel: "FLAT", price: 10, ...o }) as any;
const counts = { units: 4, buildings: 2, commonAreas: 3, buildingZones: [null, null] as (string | null)[] };

describe("serviceLineAmount", () => {
  it("multiplies by the right count", () => {
    expect(serviceLineAmount(svc({ pricingModel: "PER_UNIT", price: 2 }), counts, DEFAULT_ZONES)).toBe(8);
    expect(serviceLineAmount(svc({ pricingModel: "PER_BUILDING", price: 5 }), counts, DEFAULT_ZONES)).toBe(10);
    expect(serviceLineAmount(svc({ pricingModel: "PER_COMMON_AREA", price: 3 }), counts, DEFAULT_ZONES)).toBe(9);
    expect(serviceLineAmount(svc({ pricingModel: "FLAT", price: 12 }), counts, DEFAULT_ZONES)).toBe(12);
    expect(serviceLineAmount(svc({ pricingModel: "METERED_PREPAID", price: 99 }), counts, DEFAULT_ZONES)).toBe(0);
  });
});
describe("computePackageTotal", () => {
  it("sums lines and totals cents", () => {
    const r = computePackageTotal([svc({ id: "a", pricingModel: "PER_UNIT", price: 2 }), svc({ id: "b", pricingModel: "FLAT", price: 12 })], counts, DEFAULT_ZONES);
    expect(r.totalCents).toBe(2000);
    expect(r.lines.map((l) => l.amount)).toEqual([8, 12]);
    expect(r.lines.map((l) => l.detail)).toEqual([null, null]);
  });
});
describe("PER_ZONE", () => {
  it("adds the zone price of every building to the base price", () => {
    const s = svc({ pricingModel: "PER_ZONE", price: 10, zonePrices: { A: 0, B: 15, C: 40 } });
    expect(serviceLineAmount(s, { ...counts, buildingZones: ["B", "C"] }, DEFAULT_ZONES)).toBe(65);
  });
  it("treats unknown and missing zones as 0", () => {
    const s = svc({ pricingModel: "PER_ZONE", price: 10, zonePrices: { B: 15 } });
    expect(serviceLineAmount(s, { ...counts, buildingZones: ["Z", null] }, DEFAULT_ZONES)).toBe(10);
    expect(serviceLineAmount(svc({ pricingModel: "PER_ZONE", price: 10, zonePrices: null }), { ...counts, buildingZones: ["B"] }, DEFAULT_ZONES)).toBe(10);
  });
  it("labels the line with the per-zone breakdown", () => {
    const r = computePackageTotal([svc({ id: "z", pricingModel: "PER_ZONE", price: 10, zonePrices: { B: 15 } })], { ...counts, buildingZones: ["B", null] }, DEFAULT_ZONES);
    expect(r.lines[0]).toMatchObject({ qty: 2, amount: 25, detail: "Ζώνη Β ×1, χωρίς ζώνη ×1" });
    expect(r.totalCents).toBe(2500);
  });
});
