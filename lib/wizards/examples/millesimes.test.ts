import { describe, it, expect } from "vitest";
import { previewMillesimes, manualSumError, exampleForMillesimes, DEFAULT_EXAMPLE_EXPENSES, type MillesimesPlan } from "./millesimes";

const units = [
  { id: "a", unitNumber: "Κ1", areaSqm: 50, floor: 0 },
  { id: "b", unitNumber: "1Α", areaSqm: 100, floor: 1 },
  { id: "c", unitNumber: "2Α", areaSqm: 100, floor: 2 },
];
const auto: MillesimesPlan = { general: "AUTO", elevator: { enabled: true, surchargePerFloor: 0.1, exemptGroundFloor: true, manual: null }, heating: { basis: "HEATING_MILLESIMES", manual: null } };
const sum = (xs: (number | null)[]) => Math.round(xs.reduce<number>((s, x) => s + (x ?? 0), 0) * 100) / 100;

describe("previewMillesimes", () => {
  it("AUTO general from area sums to 1000", () => {
    const p = previewMillesimes(units, auto);
    expect(sum(p.rows.map((r) => r.general))).toBe(1000);
    expect(p.rows.map((r) => r.general)).toEqual([200, 400, 400]);
    expect(p.totals.general).toBe(1000);
  });
  it("unit without area is reported, others still sum to 1000", () => {
    const p = previewMillesimes([...units, { id: "d", unitNumber: "3Α", areaSqm: null, floor: 3 }], auto);
    expect(p.rows[3].general).toBeNull();
    expect(sum(p.rows.map((r) => r.general))).toBe(1000);
    expect(p.missingArea).toEqual(["3Α"]);
  });
  it("manual general values are used as given; elevator disabled → nulls; heating NONE → nulls", () => {
    const p = previewMillesimes(units, { general: [{ unitId: "a", value: 100 }, { unitId: "b", value: 450 }, { unitId: "c", value: 450 }], elevator: { enabled: false, surchargePerFloor: 0.1, exemptGroundFloor: true, manual: null }, heating: { basis: "NONE", manual: null } });
    expect(p.rows.map((r) => r.general)).toEqual([100, 450, 450]);
    expect(p.rows.every((r) => r.elevator === null && r.heating === null)).toBe(true);
  });
  it("exempt ground floor gets 0 elevator share", () => {
    const p = previewMillesimes(units, auto);
    expect(p.rows[0].elevator).toBe(0);
    expect(sum(p.rows.map((r) => r.elevator))).toBe(1000);
  });
});

describe("manualSumError", () => {
  it("reports missing/excess in Greek with comma decimals", () => {
    expect(manualSumError([{ value: 500 }, { value: 487.5 }])).toBe("Λείπουν 12,5‰ (σύνολο 987,5‰)");
    expect(manualSumError([{ value: 500 }, { value: 503 }])).toBe("Περισσεύουν 3‰ (σύνολο 1.003‰)");
    expect(manualSumError([{ value: 500 }, { value: 500 }])).toBeNull();
    expect(manualSumError([{ value: 999.995 }, { value: null }])).toBeNull();
  });
});

describe("exampleForMillesimes", () => {
  it("splits 1000 € by the general set and 600 € by elevator with exempt ground floor = 0", () => {
    const ex = exampleForMillesimes(units, auto, DEFAULT_EXAMPLE_EXPENSES);
    expect(ex.expenses.map((e) => e.label)).toEqual(["Καθαρισμός", "Συντήρηση ανελκυστήρα", "Πετρέλαιο θέρμανσης"]);
    expect(ex.perUnit.map((u) => u.amounts[0])).toEqual([200, 400, 400]);
    expect(ex.perUnit[0].amounts[1]).toBe(0);
    expect(sum(ex.perUnit.map((u) => u.amounts[1]))).toBe(600);
    expect(sum(ex.perUnit.map((u) => u.amounts[2]))).toBe(2000);
    expect(ex.legal.general).toContain("3741/1929");
    expect(ex.legal.elevator).toContain("20.8.1997");
    expect(ex.legal.heating).toContain("1512/1985");
  });
  it("heating NONE yields null amounts for the heating expense", () => {
    const ex = exampleForMillesimes(units, { ...auto, heating: { basis: "NONE", manual: null } }, DEFAULT_EXAMPLE_EXPENSES);
    expect(ex.perUnit.every((u) => u.amounts[2] === null)).toBe(true);
  });
});
