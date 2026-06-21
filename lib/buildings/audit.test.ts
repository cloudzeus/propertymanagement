import { describe, it, expect } from "vitest";
import { auditBuilding, type AuditInput } from "./audit";

const baseUnit = {
  unitNumber: "1", floor: 1, areaSqm: 100,
  millesimes: 1000, millesimesElevator: 1000, millesimesHeating: 1000,
  ownerId: "o1", residentId: null, hasOccupancyOwner: false, hasOccupancyResident: false,
  millesimesSource: "AUTO",
};
const base: AuditInput = {
  building: { name: "Β", address: "Ακαδημίας 12", hasElevator: true },
  units: [baseUnit],
  customer: { vat: "123" },
  heating: { meteredCategoryExists: false, readingsForLatestPeriod: 0 },
  exclusions: [],
};
const has = (fs: ReturnType<typeof auditBuilding>, sev: string, frag: string) =>
  fs.some((f) => f.severity === sev && f.title.includes(frag));

describe("auditBuilding", () => {
  it("clean building → no errors", () => {
    expect(auditBuilding(base).filter((f) => f.severity === "error")).toHaveLength(0);
  });
  it("unit without area or floor → error", () => {
    expect(has(auditBuilding({ ...base, units: [{ ...baseUnit, areaSqm: null }] }), "error", "τ.μ")).toBe(true);
    expect(has(auditBuilding({ ...base, units: [{ ...baseUnit, floor: null }] }), "error", "όροφο")).toBe(true);
  });
  it("negative area → error", () => {
    expect(has(auditBuilding({ ...base, units: [{ ...baseUnit, areaSqm: -5 }] }), "error", "Αρνητικ")).toBe(true);
  });
  it("duplicate unit numbers → error", () => {
    const fs = auditBuilding({ ...base, units: [baseUnit, { ...baseUnit, millesimes: 0 }] });
    expect(has(fs, "error", "Διπλ")).toBe(true);
  });
  it("general millesimes not 1000 → error", () => {
    const fs = auditBuilding({ ...base, units: [{ ...baseUnit, millesimes: 980 }] });
    expect(has(fs, "error", "Γενικά χιλιοστά")).toBe(true);
  });
  it("no units → error", () => {
    expect(has(auditBuilding({ ...base, units: [] }), "error", "καμία μονάδα")).toBe(true);
  });
  it("unit with no owner and no resident → warning", () => {
    const fs = auditBuilding({ ...base, units: [{ ...baseUnit, ownerId: null, residentId: null }] });
    expect(has(fs, "warning", "χωρίς ιδιοκτήτη")).toBe(true);
  });
  it("metered heating but no readings → warning", () => {
    const fs = auditBuilding({ ...base, heating: { meteredCategoryExists: true, readingsForLatestPeriod: 0 } });
    expect(has(fs, "warning", "ενδείξεις")).toBe(true);
  });
  it("exclusion zeroing a whole expense → warning", () => {
    const fs = auditBuilding({ ...base, exclusions: [{ categoryId: "c", excludedUnitCount: 1, totalUnits: 1 }] });
    expect(has(fs, "warning", "μηδενίζει")).toBe(true);
  });
  it("customer without ΑΦΜ → warning", () => {
    expect(has(auditBuilding({ ...base, customer: { vat: null } }), "warning", "ΑΦΜ")).toBe(true);
  });
  it("MANUAL millesimes → info", () => {
    const fs = auditBuilding({ ...base, units: [{ ...baseUnit, millesimesSource: "MANUAL" }] });
    expect(has(fs, "info", "κανονισμ")).toBe(true);
  });
});
