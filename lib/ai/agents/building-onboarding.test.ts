import { describe, it, expect } from "vitest";
import { onboardingSchema } from "./building-onboarding";

describe("onboardingSchema", () => {
  it("accepts a partial object (all fields optional)", () => {
    expect(onboardingSchema.safeParse({ managerName: "Γιάννης" }).success).toBe(true);
    expect(onboardingSchema.safeParse({}).success).toBe(true);
  });

  it("rejects a non-positive apartment count", () => {
    expect(onboardingSchema.safeParse({ totalApartments: 0 }).success).toBe(false);
    expect(onboardingSchema.safeParse({ totalApartments: -3 }).success).toBe(false);
  });

  it("rejects an unknown heating type", () => {
    expect(onboardingSchema.safeParse({ heatingType: "SOLAR" }).success).toBe(false);
  });

  it("accepts a valid heating type", () => {
    expect(onboardingSchema.safeParse({ heatingType: "AUTONOMOUS_METERS" }).success).toBe(true);
  });
});
