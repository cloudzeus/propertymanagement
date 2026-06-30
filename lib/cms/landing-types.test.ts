import { describe, it, expect } from "vitest";
import { LANDING_SECTION_TYPES, defaultSectionData, isSectionType } from "./landing-types";

describe("landing section types", () => {
  it("lists the six section types in render order", () => {
    expect(LANDING_SECTION_TYPES).toEqual(["HERO", "LOGOS", "FEATURES", "PRICING", "TESTIMONIALS", "CTA"]);
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
