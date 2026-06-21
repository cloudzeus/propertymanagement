import { describe, it, expect } from "vitest";
import { buildingInfoSchema, setUnitsSchema } from "./building-onboarding";

describe("buildingInfoSchema", () => {
  it("accepts partial building info incl. elevator fields", () => {
    expect(buildingInfoSchema.safeParse({ managerName: "Γ", hasElevator: true, elevatorSurchargePerFloor: 0.1 }).success).toBe(true);
    expect(buildingInfoSchema.safeParse({}).success).toBe(true);
  });
  it("rejects an unknown heating type", () => {
    expect(buildingInfoSchema.safeParse({ heatingType: "SOLAR" }).success).toBe(false);
  });
  it("rejects a surcharge outside 0..1", () => {
    expect(buildingInfoSchema.safeParse({ elevatorSurchargePerFloor: 2 }).success).toBe(false);
  });
});

describe("setUnitsSchema", () => {
  it("accepts an array of partial units", () => {
    expect(setUnitsSchema.safeParse({ units: [{ floor: 1, areaSqm: 80 }, { unitType: "SHOP" }] }).success).toBe(true);
  });
  it("rejects negative area and non-integer floor", () => {
    expect(setUnitsSchema.safeParse({ units: [{ areaSqm: -5 }] }).success).toBe(false);
    expect(setUnitsSchema.safeParse({ units: [{ floor: 1.5 }] }).success).toBe(false);
  });
  it("rejects an unknown unit type", () => {
    expect(setUnitsSchema.safeParse({ units: [{ unitType: "VILLA" }] }).success).toBe(false);
  });
});
