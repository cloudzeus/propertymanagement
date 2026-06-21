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

  const general = new Map(distributeWeights(norm.map((u) => ({ id: u._key, weight: u.areaSqm ?? 0 }))).map((r) => [r.id, r.value]));
  const heating = general; // same basis (area)
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
    millesimesHeating: heating.get(u._key) ?? null,
  }));

  return {
    building: {
      address: input.building.address ?? "",
      managerName: input.building.managerName ?? "",
      hasElevator,
      elevatorSurchargePerFloor: surcharge,
      elevatorExemptGroundFloor: exemptGround,
    },
    units,
    meteredHeating: input.building.heatingType === "AUTONOMOUS_METERS",
  };
}
