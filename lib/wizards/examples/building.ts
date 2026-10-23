/**
 * «Παράδειγμα εφαρμογής» of the building wizard: the three millesime sets the
 * entered units will get — via the SAME pure builder the server uses
 * (app/actions/building-onboarding-payload), so preview == saved.
 */
import { buildOnboardingPayload } from "@/app/actions/building-onboarding-payload";
import type { UnitDraft } from "../units-generator";

export type BuildingExampleInput = {
  units: UnitDraft[];
  hasElevator: boolean;
  elevatorSurchargePerFloor: number;
  elevatorExemptGroundFloor: boolean;
  /** Common boiler (heating is a κοινόχρηστα expense) vs individual heating (GAS). */
  heatingShared: boolean;
};

export type BuildingExampleRow = { unitNumber: string; floor: number | null; areaSqm: number | null; unitType: UnitDraft["unitType"]; general: number | null; elevator: number | null; heating: number | null };

export type BuildingExample = {
  rows: BuildingExampleRow[];
  totals: { general: number; elevator: number; heating: number };
  missingArea: string[];
};

const r2 = (n: number) => Math.round(n * 100) / 100;

export function exampleForBuilding(i: BuildingExampleInput): BuildingExample {
  const payload = buildOnboardingPayload({
    building: { hasElevator: i.hasElevator, elevatorSurchargePerFloor: i.elevatorSurchargePerFloor, elevatorExemptGroundFloor: i.elevatorExemptGroundFloor, heatingType: i.heatingShared ? "CENTRAL" : "GAS" },
    units: i.units.map((u) => ({ unitNumber: u.unitNumber, floor: u.floor ?? undefined, areaSqm: u.areaSqm != null && u.areaSqm > 0 ? u.areaSqm : undefined, unitType: u.unitType })),
  });
  const rows: BuildingExampleRow[] = payload.units.map((u) => ({
    unitNumber: u.unitNumber, floor: u.floor, areaSqm: u.areaSqm, unitType: u.unitType,
    general: u.millesimes, elevator: u.millesimesElevator, heating: u.millesimesHeating,
  }));
  const sum = (k: "general" | "elevator" | "heating") => r2(rows.reduce((s, r) => s + (r[k] ?? 0), 0));
  return {
    rows,
    totals: { general: sum("general"), elevator: sum("elevator"), heating: sum("heating") },
    missingArea: i.units.filter((u) => !(u.areaSqm != null && u.areaSqm > 0)).map((u) => u.unitNumber),
  };
}
