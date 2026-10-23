import { describe, it, expect } from "vitest";
import { PRICING_MODELS, suggestServiceCode, exampleForService, EXAMPLE_SCENARIOS } from "./service";

describe("suggestServiceCode", () => {
  it("transliterates Greek to upper-case Latin and dedupes with -2, -3", () => {
    expect(suggestServiceCode("Καθαρισμός κοινοχρήστων", [])).toBe("KATHARISMOS-KOINOCHRISTON");
    expect(suggestServiceCode("Καθαρισμός κοινοχρήστων", ["KATHARISMOS-KOINOCHRISTON"])).toBe("KATHARISMOS-KOINOCHRISTON-2");
    expect(suggestServiceCode("Καθαρισμός κοινοχρήστων", ["KATHARISMOS-KOINOCHRISTON", "KATHARISMOS-KOINOCHRISTON-2"])).toBe("KATHARISMOS-KOINOCHRISTON-3");
  });
  it("caps at 32 characters, strips punctuation and handles empty names", () => {
    expect(suggestServiceCode("Βασική διαχείριση & συντήρηση κοινοχρήστων χώρων (CORE)", []).length).toBeLessThanOrEqual(32);
    expect(suggestServiceCode("", [])).toBe("SERVICE");
    expect(suggestServiceCode("Ψ/Ξ θ ω", [])).toBe("PS-X-TH-O");
  });
});

describe("PRICING_MODELS", () => {
  it("covers the six models with Greek labels and descriptions", () => {
    expect(PRICING_MODELS.map((p) => p.value)).toEqual(["PER_UNIT", "PER_BUILDING", "PER_COMMON_AREA", "FLAT", "METERED_PREPAID", "PER_ZONE"]);
    for (const p of PRICING_MODELS) { expect(p.label.length).toBeGreaterThan(3); expect(p.description.length).toBeGreaterThan(10); }
  });
});

describe("exampleForService", () => {
  it("two scenarios with expected amounts for a per-unit service", () => {
    const ex = exampleForService({ pricingModel: "PER_UNIT", price: 3 }, []);
    expect(ex.scenarios).toHaveLength(2);
    expect(ex.scenarios[0].counts).toEqual(EXAMPLE_SCENARIOS[0].counts);
    expect(ex.scenarios[0].line.amount).toBe(15);
    expect(ex.scenarios[1].line.amount).toBe(36);
  });
  it("per-zone scenarios place buildings in the zones", () => {
    const zones = [{ code: "A", label: "Ζώνη Α", maxKm: 10, travelFee: 0 }, { code: "B", label: "Ζώνη Β", maxKm: 30, travelFee: 0 }];
    const ex = exampleForService({ pricingModel: "PER_ZONE", price: 10, zonePrices: { A: 5, B: 12 } }, zones);
    expect(ex.scenarios[0].line.amount).toBe(15); // 1 building in zone A
    expect(ex.scenarios[1].line.amount).toBe(27); // buildings in A and B
  });
});
