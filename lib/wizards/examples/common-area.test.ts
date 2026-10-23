import { describe, it, expect } from "vitest";
import { COMMON_AREA_TYPES, exampleForCommonArea, suggestedItemTypeIds } from "./common-area";

const services = [
  { name: "Συντήρηση κοινόχρηστων χώρων", price: 15, pricingModel: "PER_COMMON_AREA", enabled: true },
  { name: "Βασική διαχείριση", price: 3, pricingModel: "PER_UNIT", enabled: true },
  { name: "Καθαρισμός χώρων", price: 20, pricingModel: "PER_COMMON_AREA", enabled: false },
];

describe("exampleForCommonArea", () => {
  it("cost after = price × (n+1) for enabled per-common-area services only", () => {
    const ex = exampleForCommonArea({ name: "Κλιμακοστάσιο Α", type: "stairs", items: [], services, currentCommonAreas: 2 });
    expect(ex.costLines).toEqual([{ service: "Συντήρηση κοινόχρηστων χώρων", before: 30, after: 45 }]);
    expect(ex.costDelta).toBe(15);
  });
  it("itemLines read «3 × Αλλαγή λαμπτήρων»", () => {
    const ex = exampleForCommonArea({ name: "Είσοδος", type: "entrance", items: [{ typeName: "Αλλαγή λαμπτήρων", quantity: 3 }, { typeName: "Πυροσβεστήρας", quantity: 1 }], services: [], currentCommonAreas: 0 });
    expect(ex.itemLines).toEqual(["3 × Αλλαγή λαμπτήρων", "1 × Πυροσβεστήρας"]);
    expect(ex.costLines).toEqual([]);
    expect(ex.costDelta).toBe(0);
  });
  it("names the area type in the headline", () => {
    expect(exampleForCommonArea({ name: "Λεβητοστάσιο", type: "boiler", items: [], services: [], currentCommonAreas: 0 }).headline).toContain("Λεβητοστάσιο");
  });
});

describe("COMMON_AREA_TYPES", () => {
  it("has unique values, a label and an icon each, and «other» last", () => {
    expect(new Set(COMMON_AREA_TYPES.map((t) => t.value)).size).toBe(COMMON_AREA_TYPES.length);
    for (const t of COMMON_AREA_TYPES) { expect(t.label.length).toBeGreaterThan(0); expect(t.icon).toMatch(/^Ri/); }
    expect(COMMON_AREA_TYPES[COMMON_AREA_TYPES.length - 1].value).toBe("other");
  });
  it("suggestedItemTypeIds matches catalog names case-insensitively", () => {
    const catalog = [{ id: "t1", name: "Αλλαγή λαμπτήρων" }, { id: "t2", name: "Πυροσβεστήρες" }, { id: "t3", name: "Κάτι άσχετο" }];
    const ids = suggestedItemTypeIds("stairs", catalog);
    expect(ids).toContain("t1");
    expect(ids).not.toContain("t3");
  });
});
