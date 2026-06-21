import { describe, it, expect } from "vitest";
import { buildOnboardingPayload } from "./building-onboarding-payload";

describe("buildOnboardingPayload", () => {
  it("creates N numbered units", () => {
    const p = buildOnboardingPayload({ address: "Ακαδημίας 12", totalApartments: 3, heatingType: "CENTRAL", managerName: "Γ" });
    expect(p.units.map((u) => u.unitNumber)).toEqual(["1", "2", "3"]);
  });

  it("flags METERED heating override only for AUTONOMOUS_METERS", () => {
    expect(buildOnboardingPayload({ address: "a", totalApartments: 1, heatingType: "AUTONOMOUS_METERS", managerName: "x" }).meteredHeating).toBe(true);
    expect(buildOnboardingPayload({ address: "a", totalApartments: 1, heatingType: "CENTRAL", managerName: "x" }).meteredHeating).toBe(false);
  });

  it("carries the building name/address", () => {
    const p = buildOnboardingPayload({ address: "Ακαδημίας 12", totalApartments: 2, heatingType: "GAS", managerName: "Γ" });
    expect(p.building.address).toBe("Ακαδημίας 12");
  });
});
