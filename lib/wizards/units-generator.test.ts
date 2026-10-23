import { describe, it, expect } from "vitest";
import { generateUnits, type UnitDraft } from "./units-generator";

const base = { floors: 3, basements: 1, apartmentsPerFloor: 2, groundFloorShops: 2, groundFloorApartments: 0, parkingPerBasement: 0, defaultAreaSqm: 80, numbering: "floor-letter" as const };

describe("generateUnits", () => {
  it("3 floors × 2 apartments + 2 shops → 8 units, shops on floor 0 named Κ1/Κ2", () => {
    const u = generateUnits(base);
    expect(u).toHaveLength(8);
    expect(u.filter((x) => x.unitType === "SHOP").map((x) => [x.unitNumber, x.floor])).toEqual([["Κ1", 0], ["Κ2", 0]]);
    expect(u.filter((x) => x.unitType === "APARTMENT").map((x) => x.unitNumber)).toEqual(["1Α", "1Β", "2Α", "2Β", "3Α", "3Β"]);
    expect(u.every((x) => x.areaSqm === 80)).toBe(true);
  });
  it("sequential numbering 1..n across floors, ground-floor apartments first", () => {
    const u = generateUnits({ ...base, groundFloorShops: 0, groundFloorApartments: 1, numbering: "sequential" });
    expect(u.map((x) => x.unitNumber)).toEqual(["1", "2", "3", "4", "5", "6", "7"]);
    expect(u[0].floor).toBe(0);
    expect(u[6].floor).toBe(3);
  });
  it("adds parking units per basement only when asked", () => {
    const u = generateUnits({ ...base, parkingPerBasement: 2 });
    const p = u.filter((x) => x.unitType === "PARKING");
    expect(p.map((x) => [x.unitNumber, x.floor])).toEqual([["P-1.1", -1], ["P-1.2", -1]]);
    expect(p.every((x) => x.areaSqm === null)).toBe(true);
  });
  it("unit numbers are unique and null area when no default", () => {
    const u = generateUnits({ ...base, defaultAreaSqm: null, apartmentsPerFloor: 5 });
    expect(new Set(u.map((x) => x.unitNumber)).size).toBe(u.length);
    expect(u[0].areaSqm).toBeNull();
    expect(u.find((x) => x.unitNumber === "1Ε")).toBeTruthy();
  });
  it("returns an empty list for a zero spec", () => {
    const u: UnitDraft[] = generateUnits({ ...base, floors: 0, groundFloorShops: 0, apartmentsPerFloor: 0 });
    expect(u).toEqual([]);
  });
});
