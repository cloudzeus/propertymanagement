import { describe, it, expect } from "vitest";
import { exampleForBuilding } from "./building";
import type { UnitDraft } from "../units-generator";

const units: UnitDraft[] = [
  { unitNumber: "Κ1", floor: 0, areaSqm: 50, unitType: "SHOP" },
  { unitNumber: "1Α", floor: 1, areaSqm: 100, unitType: "APARTMENT" },
  { unitNumber: "2Α", floor: 2, areaSqm: 100, unitType: "APARTMENT" },
];
const sum = (xs: (number | null)[]) => Math.round(xs.reduce<number>((s, x) => s + (x ?? 0), 0) * 100) / 100;

describe("exampleForBuilding", () => {
  it("each set sums to 1000", () => {
    const ex = exampleForBuilding({ units, hasElevator: true, elevatorSurchargePerFloor: 0.1, elevatorExemptGroundFloor: true, heatingShared: true });
    expect(sum(ex.rows.map((r) => r.general))).toBe(1000);
    expect(sum(ex.rows.map((r) => r.elevator))).toBe(1000);
    expect(sum(ex.rows.map((r) => r.heating))).toBe(1000);
    expect(ex.totals).toEqual({ general: 1000, elevator: 1000, heating: 1000 });
  });
  it("ground floor gets 0 elevator share when exempt, more weight on higher floors", () => {
    const ex = exampleForBuilding({ units, hasElevator: true, elevatorSurchargePerFloor: 0.1, elevatorExemptGroundFloor: true, heatingShared: true });
    expect(ex.rows[0].elevator).toBe(0);
    expect(ex.rows[2].elevator!).toBeGreaterThan(ex.rows[1].elevator!);
  });
  it("no elevator → elevator column null; individual heating → heating null", () => {
    const ex = exampleForBuilding({ units, hasElevator: false, elevatorSurchargePerFloor: 0.1, elevatorExemptGroundFloor: true, heatingShared: false });
    expect(ex.rows.every((r) => r.elevator === null && r.heating === null)).toBe(true);
    expect(ex.totals.elevator).toBe(0);
  });
  it("missingArea lists units without sqm", () => {
    const ex = exampleForBuilding({ units: [...units, { unitNumber: "3Α", floor: 3, areaSqm: null, unitType: "APARTMENT" }], hasElevator: false, elevatorSurchargePerFloor: 0.1, elevatorExemptGroundFloor: true, heatingShared: true });
    expect(ex.missingArea).toEqual(["3Α"]);
    expect(sum(ex.rows.map((r) => r.general))).toBe(1000);
  });
});
