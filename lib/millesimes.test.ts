import { describe, it, expect } from "vitest";
import { computeMillesimes, distributeWeights, elevatorWeight } from "./millesimes";

// Helper: sum of non-null millesimes, rounded to 2 decimals to kill fp noise.
function sum(results: { millesimes: number | null }[]): number {
  return Math.round(results.reduce((s, r) => s + (r.millesimes ?? 0), 0) * 100) / 100;
}

describe("computeMillesimes", () => {
  it("distributes equal areas and sums to exactly 1000", () => {
    const res = computeMillesimes([
      { id: "a", areaSqm: 100 },
      { id: "b", areaSqm: 100 },
      { id: "c", areaSqm: 100 },
    ]);
    expect(sum(res)).toBe(1000);
    const byId = Object.fromEntries(res.map((r) => [r.id, r.millesimes]));
    expect(byId.a).toBe(333.34);
    expect(byId.b).toBe(333.33);
    expect(byId.c).toBe(333.33);
  });

  it("distributes unequal areas proportionally and sums to exactly 1000", () => {
    const res = computeMillesimes([
      { id: "a", areaSqm: 50 },
      { id: "b", areaSqm: 150 },
      { id: "c", areaSqm: 300 },
    ]);
    expect(sum(res)).toBe(1000);
    const byId = Object.fromEntries(res.map((r) => [r.id, r.millesimes]));
    expect(byId.a).toBe(100);
    expect(byId.b).toBe(300);
    expect(byId.c).toBe(600);
  });

  it("excludes units without area (returns null) and ignores them in the distribution", () => {
    const res = computeMillesimes([
      { id: "a", areaSqm: 100 },
      { id: "b", areaSqm: null },
      { id: "c", areaSqm: 100 },
    ]);
    const byId = Object.fromEntries(res.map((r) => [r.id, r.millesimes]));
    expect(byId.b).toBeNull();
    expect(sum(res)).toBe(1000);
    expect(byId.a).toBe(500);
    expect(byId.c).toBe(500);
  });

  it("returns all null when no unit has area", () => {
    const res = computeMillesimes([
      { id: "a", areaSqm: null },
      { id: "b", areaSqm: 0 },
    ]);
    expect(res.every((r) => r.millesimes === null)).toBe(true);
  });

  it("assigns 1000 to a single unit with area", () => {
    const res = computeMillesimes([{ id: "a", areaSqm: 80 }]);
    expect(res[0].millesimes).toBe(1000);
  });
});

describe("distributeWeights", () => {
  it("distributes 1000 by weight, remainder on largest", () => {
    const r = distributeWeights([
      { id: "a", weight: 100 },
      { id: "b", weight: 100 },
      { id: "c", weight: 100 },
    ]);
    expect(r.find((x) => x.id === "a")!.value! + r.find((x) => x.id === "b")!.value! + r.find((x) => x.id === "c")!.value!).toBe(1000);
  });

  it("zero/negative weights become null and are excluded", () => {
    const r = distributeWeights([
      { id: "a", weight: 0 },
      { id: "b", weight: 50 },
      { id: "c", weight: 50 },
    ]);
    expect(r.find((x) => x.id === "a")!.value).toBeNull();
    expect(r.find((x) => x.id === "b")!.value).toBe(500);
  });

  it("all-zero returns all null", () => {
    const r = distributeWeights([{ id: "a", weight: 0 }]);
    expect(r[0].value).toBeNull();
  });
});

describe("elevatorWeight", () => {
  it("ground floor excluded when exempt", () => {
    expect(elevatorWeight(80, 0, 0.1, true)).toBe(0);
  });
  it("higher floors weigh more", () => {
    expect(elevatorWeight(80, 2, 0.1, true)).toBeCloseTo(96); // 80 * (1 + 0.1*2)
  });
  it("ground floor counted when not exempt", () => {
    expect(elevatorWeight(80, 0, 0.1, false)).toBe(80);
  });
});
