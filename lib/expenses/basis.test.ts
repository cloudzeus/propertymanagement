import { describe, it, expect } from "vitest";
import { resolveWeights, type BasisUnit } from "./basis";

const units: BasisUnit[] = [
  { unitId: "shop", millesimes: 240, millesimesElevator: 0, millesimesHeating: 0, excluded: false },
  { unitId: "a1", millesimes: 160, millesimesElevator: 176, millesimesHeating: 160, excluded: false },
  { unitId: "b1", millesimes: 120, millesimesElevator: 312, millesimesHeating: 340, excluded: false },
];

describe("resolveWeights", () => {
  it("GENERAL uses millesimes", () => {
    const w = resolveWeights("GENERAL_MILLESIMES", units, null);
    expect(w.get("shop")).toBe(240);
  });

  it("ELEVATOR uses elevator set", () => {
    const w = resolveWeights("ELEVATOR_MILLESIMES", units, null);
    expect(w.get("a1")).toBe(176);
  });

  it("EQUAL gives all participants weight 1", () => {
    const w = resolveWeights("EQUAL_PER_UNIT", units, null);
    expect(w.get("shop")).toBe(1);
    expect(w.get("b1")).toBe(1);
  });

  it("excluded units get weight 0 regardless of basis", () => {
    const w = resolveWeights("GENERAL_MILLESIMES",
      units.map((u) => (u.unitId === "shop" ? { ...u, excluded: true } : u)), null);
    expect(w.get("shop")).toBe(0);
    expect(w.get("a1")).toBe(160);
  });

  it("METERED_70_30 weights = 0.30 share of heating millesimes + 0.70 of meter readings", () => {
    const readings = new Map([["a1", 18], ["b1", 0], ["shop", 0]]);
    const w = resolveWeights("METERED_70_30", units, readings);
    // a1 carries all metered weight + its heating share → strictly greater than b1
    expect(w.get("a1")!).toBeGreaterThan(w.get("b1")!);
  });
});
