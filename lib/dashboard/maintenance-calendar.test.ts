import { describe, it, expect } from "vitest";
import { expandOccurrences } from "./maintenance-calendar";

const from = new Date("2026-07-01T00:00:00Z");
const to = new Date("2026-07-31T23:59:59Z");

describe("expandOccurrences", () => {
  it("projects a weekly task across the window", () => {
    const out = expandOccurrences(new Date("2026-07-06T00:00:00Z"), "WEEKLY", from, to);
    expect(out.map((d) => d.toISOString().slice(0, 10))).toEqual(["2026-07-06", "2026-07-13", "2026-07-20", "2026-07-27"]);
  });

  it("emits a single occurrence for CUSTOM frequency", () => {
    const out = expandOccurrences(new Date("2026-07-10T00:00:00Z"), "CUSTOM", from, to);
    expect(out).toHaveLength(1);
  });

  it("includes an overdue occurrence before the window start (clamped to one)", () => {
    const out = expandOccurrences(new Date("2026-06-05T00:00:00Z"), "MONTHLY", from, to);
    expect(out.map((d) => d.toISOString().slice(0, 10))).toEqual(["2026-06-05", "2026-07-05"]);
  });

  it("returns empty when there is no due date", () => {
    expect(expandOccurrences(null, "WEEKLY", from, to)).toEqual([]);
  });

  it("caps runaway projections at 500 occurrences", () => {
    const out = expandOccurrences(new Date("2020-01-01T00:00:00Z"), "WEEKLY", from, new Date("2100-01-01T00:00:00Z"));
    expect(out.length).toBeLessThanOrEqual(500);
  });
});
