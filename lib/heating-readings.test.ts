import { describe, it, expect } from "vitest";
import { computeConsumption, toConsumptionMap, type ReadingRow } from "./heating-readings";

const rows: ReadingRow[] = [
  { unitId: "a", previousReading: 1240, currentReading: 1318 }, // 78
  { unitId: "b", previousReading: 980, currentReading: 1022 },  // 42
  { unitId: "c", previousReading: 2110, currentReading: 2270 }, // 160
];

describe("computeConsumption", () => {
  it("consumption = current - previous", () => {
    const r = computeConsumption(rows);
    expect(r.find((x) => x.unitId === "a")!.consumption).toBe(78);
    expect(r.every((x) => !x.negative)).toBe(true);
  });

  it("missing reading → null consumption, not negative", () => {
    const r = computeConsumption([{ unitId: "x", previousReading: 100, currentReading: null }]);
    expect(r[0].consumption).toBeNull();
    expect(r[0].negative).toBe(false);
  });

  it("current < previous → negative flag, consumption clamped to 0", () => {
    const r = computeConsumption([{ unitId: "y", previousReading: 500, currentReading: 480 }]);
    expect(r[0].negative).toBe(true);
    expect(r[0].consumption).toBe(0);
  });

  it("missing previous treats previous as 0", () => {
    const r = computeConsumption([{ unitId: "z", previousReading: null, currentReading: 30 }]);
    expect(r[0].consumption).toBe(30);
  });
});

describe("toConsumptionMap", () => {
  it("includes only positive consumption, skips null/negative", () => {
    const m = toConsumptionMap([
      { unitId: "a", previousReading: 0, currentReading: 78 },
      { unitId: "b", previousReading: 100, currentReading: null }, // null → skip
      { unitId: "c", previousReading: 500, currentReading: 480 },  // negative → skip
    ]);
    expect(m.get("a")).toBe(78);
    expect(m.has("b")).toBe(false);
    expect(m.has("c")).toBe(false);
  });
});
