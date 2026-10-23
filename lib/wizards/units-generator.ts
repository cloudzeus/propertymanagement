/**
 * Generates the unit list of a building from a few numbers («3 όροφοι × 2
 * διαμερίσματα, 2 καταστήματα στο ισόγειο») — the user then edits the grid.
 * Pure; shared by the building wizard and its example step.
 */
export type UnitDraft = {
  unitNumber: string;
  floor: number | null;
  areaSqm: number | null;
  unitType: "APARTMENT" | "SHOP" | "PARKING" | "OTHER";
};

export type UnitsSpec = {
  floors: number;
  basements: number;
  apartmentsPerFloor: number;
  groundFloorShops: number;
  groundFloorApartments: number;
  parkingPerBasement: number;
  defaultAreaSqm: number | null;
  /** «1Α, 1Β…» per floor (shops Κ1, Κ2…) or «1, 2, 3…» across the building. */
  numbering: "floor-letter" | "sequential";
};

const LETTERS = "ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ";
const letter = (i: number) => (i < LETTERS.length ? LETTERS[i] : `${LETTERS[i % LETTERS.length]}${Math.floor(i / LETTERS.length) + 1}`);

export function generateUnits(spec: UnitsSpec): UnitDraft[] {
  const out: UnitDraft[] = [];
  const n = (v: number) => Math.max(0, Math.floor(v || 0));
  let seq = 1;
  const area = spec.defaultAreaSqm && spec.defaultAreaSqm > 0 ? spec.defaultAreaSqm : null;

  // Basements: parking spaces (no area → excluded from millesimes unless edited).
  for (let b = 1; b <= n(spec.basements); b++) {
    for (let i = 1; i <= n(spec.parkingPerBasement); i++) {
      out.push({ unitNumber: spec.numbering === "sequential" ? String(seq++) : `P-${b}.${i}`, floor: -b, areaSqm: null, unitType: "PARKING" });
    }
  }
  // Ground floor: shops, then apartments.
  for (let i = 0; i < n(spec.groundFloorShops); i++) {
    out.push({ unitNumber: spec.numbering === "sequential" ? String(seq++) : `Κ${i + 1}`, floor: 0, areaSqm: area, unitType: "SHOP" });
  }
  for (let i = 0; i < n(spec.groundFloorApartments); i++) {
    out.push({ unitNumber: spec.numbering === "sequential" ? String(seq++) : `0${letter(i)}`, floor: 0, areaSqm: area, unitType: "APARTMENT" });
  }
  // Floors 1..N.
  for (let fl = 1; fl <= n(spec.floors); fl++) {
    for (let i = 0; i < n(spec.apartmentsPerFloor); i++) {
      out.push({ unitNumber: spec.numbering === "sequential" ? String(seq++) : `${fl}${letter(i)}`, floor: fl, areaSqm: area, unitType: "APARTMENT" });
    }
  }
  return out;
}

/** Unit numbers that appear more than once (trimmed, case-insensitive). */
export function duplicateUnitNumbers(units: { unitNumber: string }[]): string[] {
  const seen = new Map<string, number>();
  for (const u of units) { const k = u.unitNumber.trim().toLocaleUpperCase("el"); seen.set(k, (seen.get(k) ?? 0) + 1); }
  return [...seen.entries()].filter(([, c]) => c > 1).map(([k]) => k);
}
