import { describe, it, expect } from "vitest";
import { normalizeAfm, isValidGreekAfm, normalizeWorkingHours, formatHoursSummary } from "./suppliers-shared";

describe("normalizeAfm", () => {
  it("strips everything but digits", () => {
    expect(normalizeAfm("ΑΦΜ: 094 019 245")).toBe("094019245");
    expect(normalizeAfm("EL094019245")).toBe("094019245");
  });
  it("returns null for empty / non-numeric input", () => {
    expect(normalizeAfm("")).toBeNull();
    expect(normalizeAfm(null)).toBeNull();
    expect(normalizeAfm("ΑΦΜ")).toBeNull();
  });
});

describe("isValidGreekAfm", () => {
  it("accepts a valid checksum (ΔΕΗ 090000045)", () => {
    expect(isValidGreekAfm("090000045")).toBe(true);
  });
  it("rejects wrong length or checksum", () => {
    expect(isValidGreekAfm("12345678")).toBe(false);
    expect(isValidGreekAfm("090000046")).toBe(false);
  });
});

describe("normalizeWorkingHours", () => {
  it("keeps only well-formed HH:MM ranges with start < end, sorted", () => {
    const out = normalizeWorkingHours({
      "1": [["14:00", "18:00"], ["09:00", "13:00"]],
      "2": [["9:00", "17:00"], ["17:00", "17:00"], "junk"],
      "9": [["09:00", "10:00"]],
      "3": "no",
    });
    expect(out).toEqual({ "1": [["09:00", "13:00"], ["14:00", "18:00"]] });
  });
  it("returns {} for garbage", () => {
    expect(normalizeWorkingHours(null)).toEqual({});
    expect(normalizeWorkingHours("x")).toEqual({});
  });
});

describe("formatHoursSummary", () => {
  it("collapses consecutive identical days", () => {
    const s = formatHoursSummary({
      "1": [["09:00", "17:00"]], "2": [["09:00", "17:00"]], "3": [["09:00", "17:00"]],
      "4": [["09:00", "17:00"]], "5": [["09:00", "17:00"]], "6": [["09:00", "14:00"]],
    });
    expect(s).toBe("Δε–Πα 09:00–17:00 · Σα 09:00–14:00");
  });
  it("does not merge across a gap day", () => {
    const s = formatHoursSummary({ "1": [["09:00", "17:00"]], "3": [["09:00", "17:00"]] });
    expect(s).toBe("Δε 09:00–17:00 · Τε 09:00–17:00");
  });
  it("handles empty", () => {
    expect(formatHoursSummary(null)).toBe("—");
    expect(formatHoursSummary({})).toBe("—");
  });
});
