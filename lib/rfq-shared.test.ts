import { describe, it, expect } from "vitest";
import { addBusinessDays, businessDaysUntil, applyMarkup, withVat } from "./rfq-shared";

describe("business days", () => {
  it("skips weekends", () => {
    // Fri 2026-09-04 + 1 business day → Mon 2026-09-07
    expect(addBusinessDays(new Date(2026, 8, 4, 10), 1).getDate()).toBe(7);
    // Mon + 5 → next Mon
    expect(addBusinessDays(new Date(2026, 8, 7), 5).getDate()).toBe(14);
    expect(addBusinessDays(new Date(2026, 8, 7), 0).getDate()).toBe(7);
  });
  it("counts remaining business days", () => {
    expect(businessDaysUntil(new Date(2026, 8, 14), new Date(2026, 8, 7))).toBe(5);
    expect(businessDaysUntil(new Date(2026, 8, 7), new Date(2026, 8, 9))).toBe(-2);
    expect(businessDaysUntil(new Date(2026, 8, 7), new Date(2026, 8, 7))).toBe(0);
  });
});

describe("pricing", () => {
  it("applies markup and VAT with 2-decimal rounding", () => {
    expect(applyMarkup(100, 15)).toBe(115);
    expect(withVat(115, 24)).toBe(142.6);
  });
});
