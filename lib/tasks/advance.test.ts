import { describe, it, expect } from "vitest";
import { advanceDue } from "./advance";

/* One rule for «next due date» — used by the recurring-task server action and the wizard example. */
describe("advanceDue", () => {
  it("keeps the day of month and clamps to the last day of shorter months", () => {
    expect(advanceDue(new Date(Date.UTC(2026, 0, 31)), "MONTHLY").toISOString().slice(0, 10)).toBe("2026-02-28");
    expect(advanceDue(new Date(Date.UTC(2026, 2, 31)), "MONTHLY").toISOString().slice(0, 10)).toBe("2026-04-30");
    expect(advanceDue(new Date(Date.UTC(2026, 0, 31)), "QUARTERLY").toISOString().slice(0, 10)).toBe("2026-04-30");
    expect(advanceDue(new Date(Date.UTC(2026, 7, 31)), "SEMIANNUAL").toISOString().slice(0, 10)).toBe("2027-02-28");
    expect(advanceDue(new Date(Date.UTC(2024, 1, 29)), "ANNUAL").toISOString().slice(0, 10)).toBe("2025-02-28");
  });
  it("adds 7 days weekly and leaves CUSTOM unchanged", () => {
    expect(advanceDue(new Date(Date.UTC(2026, 11, 28)), "WEEKLY").toISOString().slice(0, 10)).toBe("2027-01-04");
    expect(advanceDue(new Date(Date.UTC(2026, 0, 10)), "CUSTOM").toISOString().slice(0, 10)).toBe("2026-01-10");
  });
  it("keeps the time of day", () => {
    expect(advanceDue(new Date("2026-01-15T09:30:00.000Z"), "MONTHLY").toISOString()).toBe("2026-02-15T09:30:00.000Z");
  });
});
