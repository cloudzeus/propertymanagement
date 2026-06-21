import { describe, it, expect } from "vitest";
import { buildOnboardingPayload } from "./building-onboarding-payload";

const base = {
  building: { address: "Ακαδημίας 12", managerName: "Γ", heatingType: "CENTRAL" as const, hasElevator: true, elevatorSurchargePerFloor: 0.1, elevatorExemptGroundFloor: true },
};

describe("buildOnboardingPayload", () => {
  it("auto-numbers blank unit numbers and defaults type to APARTMENT", () => {
    const p = buildOnboardingPayload({ ...base, units: [{ floor: 1, areaSqm: 80 }, { floor: 2, areaSqm: 80 }] });
    expect(p.units.map((u) => u.unitNumber)).toEqual(["1", "2"]);
    expect(p.units[0].unitType).toBe("APARTMENT");
  });

  it("computes general millesimes from area summing to 1000", () => {
    const p = buildOnboardingPayload({ ...base, units: [{ floor: 1, areaSqm: 100 }, { floor: 2, areaSqm: 100 }, { floor: 3, areaSqm: 200 }] });
    const sum = p.units.reduce((s, u) => s + (u.millesimes ?? 0), 0);
    expect(Math.round(sum)).toBe(1000);
  });

  it("excludes a unit without area from millesimes (null) but others still sum to 1000", () => {
    const p = buildOnboardingPayload({ ...base, units: [{ floor: 1, areaSqm: 100 }, { floor: 1 }] });
    const noArea = p.units.find((u) => u.areaSqm == null)!;
    expect(noArea.millesimes).toBeNull();
    expect(Math.round(p.units.reduce((s, u) => s + (u.millesimes ?? 0), 0))).toBe(1000);
  });

  it("ground floor gets 0 elevator millesimes when exempt; elevator set sums to 1000", () => {
    const p = buildOnboardingPayload({ ...base, units: [{ floor: 0, areaSqm: 100, unitType: "SHOP" }, { floor: 1, areaSqm: 100 }, { floor: 2, areaSqm: 100 }] });
    const ground = p.units.find((u) => u.floor === 0)!;
    expect(ground.millesimesElevator).toBe(0);
    const sumElev = p.units.reduce((s, u) => s + (u.millesimesElevator ?? 0), 0);
    expect(Math.round(sumElev)).toBe(1000);
  });

  it("no elevator → elevator millesimes all null", () => {
    const p = buildOnboardingPayload({ building: { ...base.building, hasElevator: false }, units: [{ floor: 1, areaSqm: 80 }] });
    expect(p.units[0].millesimesElevator).toBeNull();
  });

  it("flags metered heating for AUTONOMOUS_METERS and AUTONOMOUS_HOURS, not CENTRAL", () => {
    expect(buildOnboardingPayload({ building: { ...base.building, heatingType: "AUTONOMOUS_METERS" }, units: [{ floor: 1, areaSqm: 1 }] }).meteredHeating).toBe(true);
    expect(buildOnboardingPayload({ building: { ...base.building, heatingType: "AUTONOMOUS_HOURS" }, units: [{ floor: 1, areaSqm: 1 }] }).meteredHeating).toBe(true);
    expect(buildOnboardingPayload({ ...base, units: [{ floor: 1, areaSqm: 1 }] }).meteredHeating).toBe(false);
  });

  it("GAS (individual boilers) → heating excluded: millesimesHeating null for all units, heatingShared false", () => {
    const p = buildOnboardingPayload({ building: { ...base.building, heatingType: "GAS" }, units: [{ floor: 1, areaSqm: 80 }, { floor: 2, areaSqm: 120 }] });
    expect(p.units.every((u) => u.millesimesHeating === null)).toBe(true);
    expect(p.heatingShared).toBe(false);
    expect(p.meteredHeating).toBe(false);
  });

  it("CENTRAL → heating shared with area-based millesimes summing to 1000", () => {
    const p = buildOnboardingPayload({ ...base, units: [{ floor: 1, areaSqm: 100 }, { floor: 2, areaSqm: 100 }] });
    expect(p.heatingShared).toBe(true);
    expect(Math.round(p.units.reduce((s, u) => s + (u.millesimesHeating ?? 0), 0))).toBe(1000);
  });
});
