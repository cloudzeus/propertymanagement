import { describe, it, expect } from "vitest";
import { computeAllocation, type AllocUnit } from "./allocation";

const units: AllocUnit[] = [
  { unitId: "a", millesimes: 500, ownerUserId: "o1", tenantUserId: "t1" },
  { unitId: "b", millesimes: 300, ownerUserId: "o2", tenantUserId: null },
  { unitId: "c", millesimes: 200, ownerUserId: "o3", tenantUserId: "t3" },
];

describe("computeAllocation", () => {
  it("distributes by millesimes and sums to total", () => {
    const rows = computeAllocation({ total: 100, tenantPct: 100, ownerPct: 0, units });
    expect(rows.map(r => r.unitShare)).toEqual([50, 30, 20]);
    expect(rows.reduce((s, r) => s + r.unitShare, 0)).toBe(100);
  });
  it("splits each share by tenant/owner pct", () => {
    const rows = computeAllocation({ total: 100, tenantPct: 60, ownerPct: 40, units });
    expect(rows[0].tenantAmount).toBe(30);
    expect(rows[0].ownerAmount).toBe(20);
  });
  it("absorbs rounding remainder in the last unit so the sum is exact", () => {
    const u: AllocUnit[] = [
      { unitId: "x", millesimes: 1, ownerUserId: null, tenantUserId: null },
      { unitId: "y", millesimes: 1, ownerUserId: null, tenantUserId: null },
      { unitId: "z", millesimes: 1, ownerUserId: null, tenantUserId: null },
    ];
    const rows = computeAllocation({ total: 100, tenantPct: 0, ownerPct: 100, units: u });
    expect(rows.reduce((s, r) => s + r.unitShare, 0)).toBe(100);
    expect(rows[2].unitShare).toBeCloseTo(33.34, 2);
  });
  it("flags units with null/zero millesimes and excludes them from the weight base", () => {
    const u: AllocUnit[] = [
      { unitId: "a", millesimes: 600, ownerUserId: null, tenantUserId: null },
      { unitId: "b", millesimes: null, ownerUserId: null, tenantUserId: null },
    ];
    const rows = computeAllocation({ total: 100, tenantPct: 0, ownerPct: 100, units: u });
    expect(rows.find(r => r.unitId === "a")!.unitShare).toBe(100);
    expect(rows.find(r => r.unitId === "b")!.unitShare).toBe(0);
    expect(rows.find(r => r.unitId === "b")!.missingMillesimes).toBe(true);
  });
});
