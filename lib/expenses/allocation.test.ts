import { describe, it, expect } from "vitest";
import { computeAllocation, type AllocUnit } from "./allocation";

const u = (unitId: string, weight: number): AllocUnit => ({
  unitId, weight, ownerUserId: unitId + "-o", tenantUserId: null,
});

describe("computeAllocation (weights)", () => {
  it("splits total by weight; shares sum to total", () => {
    const rows = computeAllocation({ total: 100, tenantPct: 0, ownerPct: 100, units: [u("a", 600), u("b", 400)] });
    const sum = rows.reduce((s, r) => s + r.unitShare, 0);
    expect(sum).toBe(100);
    expect(rows.find((r) => r.unitId === "a")!.unitShare).toBe(60);
  });

  it("excluded (weight 0) unit gets 0; others re-normalise to full total", () => {
    const rows = computeAllocation({ total: 100, tenantPct: 0, ownerPct: 100, units: [u("shop", 0), u("a", 100), u("b", 100)] });
    expect(rows.find((r) => r.unitId === "shop")!.unitShare).toBe(0);
    expect(rows.reduce((s, r) => s + r.unitShare, 0)).toBe(100);
  });

  it("tenant split applies", () => {
    const rows = computeAllocation({ total: 100, tenantPct: 25, ownerPct: 75, units: [u("a", 100)] });
    expect(rows[0].tenantAmount).toBe(25);
    expect(rows[0].ownerAmount).toBe(75);
  });
});
