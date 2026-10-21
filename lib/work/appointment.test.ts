import { describe, it, expect } from "vitest";
import { combineLocal, roundTo30, TIME_OPTIONS } from "./appointment";

describe("combineLocal", () => {
  it("combines a date and a time into an ISO string in the local timezone", () => {
    const iso = combineLocal("2026-10-22", "09:30")!;
    const d = new Date(iso);
    expect(d.getFullYear()).toBe(2026); expect(d.getMonth()).toBe(9); expect(d.getDate()).toBe(22);
    expect(d.getHours()).toBe(9); expect(d.getMinutes()).toBe(30); expect(d.getSeconds()).toBe(0);
  });
  it("is null when either part is empty or invalid", () => {
    expect(combineLocal("", "09:30")).toBeNull();
    expect(combineLocal("2026-10-22", "")).toBeNull();
    expect(combineLocal("not-a-date", "09:30")).toBeNull();
  });
});

describe("roundTo30", () => {
  it("rounds to the nearest 30 minutes with a 30-minute floor", () => {
    expect(roundTo30(45, 60)).toBe(60);
    expect(roundTo30(20, 60)).toBe(30);
    expect(roundTo30(10, 60)).toBe(30);
    expect(roundTo30(90, 60)).toBe(90);
  });
  it("falls back for NaN, zero, negative, null and undefined", () => {
    expect(roundTo30(0, 60)).toBe(60);
    expect(roundTo30(-5, 60)).toBe(60);
    expect(roundTo30(Number.NaN, 60)).toBe(60);
    expect(roundTo30(null, 90)).toBe(90);
    expect(roundTo30(undefined, 60)).toBe(60);
  });
});

describe("TIME_OPTIONS", () => {
  it("runs 06:00 … 21:30 in 30-minute steps", () => {
    expect(TIME_OPTIONS).toHaveLength(32);
    expect(TIME_OPTIONS[0]).toBe("06:00");
    expect(TIME_OPTIONS[1]).toBe("06:30");
    expect(TIME_OPTIONS[31]).toBe("21:30");
  });
});
