import { distributeWeights, elevatorWeight } from "@/lib/millesimes";
import type { BuildingInfo, UnitInfo } from "@/lib/ai/agents/building-onboarding";

export type OnboardingPayloadInput = { building: BuildingInfo; units: UnitInfo[] };

export type BuiltUnit = {
  unitNumber: string;
  floor: number | null;
  areaSqm: number | null;
  unitType: "APARTMENT" | "SHOP" | "PARKING" | "OTHER";
  millesimes: number | null;
  millesimesElevator: number | null;
  millesimesHeating: number | null;
};

/** Pure: normalize units + compute the 3 millesime sets. No server deps. */
export function buildOnboardingPayload(input: OnboardingPayloadInput) {
  const surcharge = input.building.elevatorSurchargePerFloor ?? 0.1;
  const exemptGround = input.building.elevatorExemptGroundFloor ?? true;
  const hasElevator = input.building.hasElevator ?? false;

  const norm = input.units.map((u, i) => ({
    unitNumber: u.unitNumber?.trim() || String(i + 1),
    floor: u.floor ?? null,
    areaSqm: u.areaSqm ?? null,
    unitType: (u.unitType ?? "APARTMENT") as BuiltUnit["unitType"],
    _key: String(i),
  }));

  // Heating is a κοινόχρηστα expense only when there is a COMMON boiler. GAS means
  // an individual per-unit boiler — each owner pays their own bill, so heating is
  // excluded from κοινόχρηστα: no heating millesimes at all.
  const heatingType = input.building.heatingType;
  const heatingShared = heatingType != null && heatingType !== "GAS";

  const general = new Map(distributeWeights(norm.map((u) => ({ id: u._key, weight: u.areaSqm ?? 0 }))).map((r) => [r.id, r.value]));
  const heating = heatingShared ? general : null; // area basis; null when individual (GAS)
  const elevator = hasElevator
    ? new Map(distributeWeights(norm.map((u) => ({ id: u._key, weight: elevatorWeight(u.areaSqm ?? 0, u.floor, surcharge, exemptGround) }))).map((r) => [r.id, r.value]))
    : null;

  const units: BuiltUnit[] = norm.map((u) => ({
    unitNumber: u.unitNumber,
    floor: u.floor,
    areaSqm: u.areaSqm,
    unitType: u.unitType,
    millesimes: general.get(u._key) ?? null,
    // A unit with an area but a zero elevator weight (e.g. exempt ground floor)
    // gets a real 0 share; a unit with no area at all stays null.
    millesimesElevator: elevator
      ? (elevator.get(u._key) ?? (u.areaSqm != null ? 0 : null))
      : null,
    millesimesHeating: heating ? (heating.get(u._key) ?? null) : null,
  }));

  return {
    building: {
      address: input.building.address ?? "",
      managerName: input.building.managerName ?? "",
      city: input.building.city ?? "",
      postalCode: input.building.postalCode ?? "",
      lat: input.building.lat ?? null,
      lng: input.building.lng ?? null,
      hasElevator,
      elevatorSurchargePerFloor: surcharge,
      elevatorExemptGroundFloor: exemptGround,
    },
    units,
    // Common boiler with per-unit meters (hours or heat units) → 70/30 distribution.
    meteredHeating: heatingType === "AUTONOMOUS_METERS" || heatingType === "AUTONOMOUS_HOURS",
    // GAS = individual boilers → heating excluded from κοινόχρηστα entirely.
    heatingShared,
  };
}
