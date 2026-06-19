import { describe, it, expect } from "vitest";
import { computeConsumption, pickCategory } from "./normalize";

describe("computeConsumption", () => {
  it("returns current - previous when both present and positive", () => { expect(computeConsumption(120, 100)).toBe(20); });
  it("returns null when a reading is missing", () => { expect(computeConsumption(null, 100)).toBeNull(); });
  it("returns null on negative result (meter rollover/error)", () => { expect(computeConsumption(50, 100)).toBeNull(); });
});

describe("pickCategory", () => {
  const codes = ["POWER", "WATER", "OTHER"];
  it("keeps a valid suggested code", () => { expect(pickCategory("WATER", codes)).toBe("WATER"); });
  it("falls back to null for an unknown code", () => { expect(pickCategory("FOO", codes)).toBeNull(); });
  it("returns null for null input", () => { expect(pickCategory(null, codes)).toBeNull(); });
});
