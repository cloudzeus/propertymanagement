import { describe, it, expect } from "vitest";
import { LANDING_SECTION_TYPES, defaultSectionData, isSectionType } from "./landing-types";

describe("landing section types", () => {
  it("lists the section types in render order, chrome last", () => {
    expect(LANDING_SECTION_TYPES).toEqual([
      "HERO", "LOGOS", "STATS", "FEATURES", "ROLES", "HOW", "CALCULATOR", "SHOWCASE",
      "PRICING", "TESTIMONIALS", "CTA", "NEWS", "NAV", "FOOTER",
    ]);
  });
  it("puts the calculator between How it works and the showcase", () => {
    const order = LANDING_SECTION_TYPES as readonly string[];
    expect(order.indexOf("CALCULATOR")).toBe(order.indexOf("HOW") + 1);
    expect(order.indexOf("SHOWCASE")).toBe(order.indexOf("CALCULATOR") + 1);
  });
  it("seeds the calculator with the handoff rates", () => {
    expect(defaultSectionData("CALCULATOR")).toMatchObject({
      rates: { essential: 1.2, standard: 2.2, pro: 3.4 },
      minimums: { essential: 18, standard: 32, pro: 55 },
      annualMultiplier: 0.8,
    });
  });
  it("isSectionType guards unknown values", () => {
    expect(isSectionType("HERO")).toBe(true);
    expect(isSectionType("NOPE")).toBe(false);
  });
  it("provides default data per type with required keys", () => {
    expect(defaultSectionData("HERO")).toMatchObject({ title: expect.any(String), primaryCta: { label: expect.any(String), href: expect.any(String) } });
    expect(defaultSectionData("FEATURES")).toMatchObject({ heading: expect.any(String), items: expect.any(Array) });
    expect(defaultSectionData("TESTIMONIALS").items).toEqual([]);
  });
});
