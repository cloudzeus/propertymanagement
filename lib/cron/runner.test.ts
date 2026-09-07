import { describe, it, expect } from "vitest";
import { isDue } from "./runner";
import type { CronJob } from "./jobs";

const daily = { key: "d", label: "", description: "", schedule: { kind: "daily", hour: 7 }, run: async () => ({}) } as CronJob;
const monthly = { ...daily, key: "m", schedule: { kind: "monthly", hour: 6 } } as CronJob;
// 2026-09-07 is a Monday; times below are UTC (Athens = UTC+3 in September)
const at = (iso: string) => new Date(iso);

describe("cron isDue", () => {
  it("daily: not before the hour, once per Athens day", () => {
    expect(isDue(daily, null, at("2026-09-07T03:30:00Z"))).toBe(false); // 06:30 Athens
    expect(isDue(daily, null, at("2026-09-07T04:30:00Z"))).toBe(true);  // 07:30 Athens
    expect(isDue(daily, at("2026-09-07T04:35:00Z"), at("2026-09-07T10:00:00Z"))).toBe(false);
    expect(isDue(daily, at("2026-09-06T04:35:00Z"), at("2026-09-07T10:00:00Z"))).toBe(true);
  });
  it("monthly: only on the 1st and once per month", () => {
    expect(isDue(monthly, null, at("2026-09-07T10:00:00Z"))).toBe(false);
    expect(isDue(monthly, null, at("2026-10-01T05:00:00Z"))).toBe(true);
    expect(isDue(monthly, at("2026-10-01T05:10:00Z"), at("2026-10-01T12:00:00Z"))).toBe(false);
  });
});
