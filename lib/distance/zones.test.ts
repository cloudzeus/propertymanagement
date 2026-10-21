import { describe, it, expect } from "vitest";
import { DEFAULT_ZONES, parseZones, validateZones, zoneForKm, zoneFee, zoneLabel, formatDistance, summarizeZones, describeBuildingDistance } from "./zones";

describe("parseZones", () => {
  it("falls back to defaults for null/invalid", () => {
    expect(parseZones(null)).toEqual(DEFAULT_ZONES);
    expect(parseZones("x")).toEqual(DEFAULT_ZONES);
    expect(parseZones([{ code: "A" }])).toEqual(DEFAULT_ZONES); // λείπει travelFee → άκυρο
  });
  it("keeps a valid stored list", () => {
    const z = [{ code: "N", label: "Κοντά", maxKm: 5, travelFee: 0 }, { code: "F", label: "Μακριά", maxKm: null, travelFee: 20 }];
    expect(parseZones(z)).toEqual(z);
  });
});

describe("validateZones", () => {
  it("accepts defaults", () => expect(validateZones(DEFAULT_ZONES)).toBeNull());
  it("rejects empty, duplicate codes, non-increasing limits, closed last zone, negative fee, NaN, > MAX", () => {
    expect(validateZones([])).toMatch(/τουλάχιστον/);
    expect(validateZones([{ code: "A", label: "a", maxKm: 10, travelFee: 0 }, { code: "A", label: "b", maxKm: null, travelFee: 0 }])).toMatch(/κωδικ/);
    expect(validateZones([{ code: "A", label: "a", maxKm: 30, travelFee: 0 }, { code: "B", label: "b", maxKm: 10, travelFee: 0 }, { code: "C", label: "c", maxKm: null, travelFee: 0 }])).toMatch(/αύξουσα/);
    expect(validateZones([{ code: "A", label: "a", maxKm: 10, travelFee: 0 }])).toMatch(/τελευταία/);
    expect(validateZones([{ code: "A", label: "a", maxKm: null, travelFee: -1 }])).toMatch(/ποσ/);
    expect(validateZones([{ code: "A", label: "a", maxKm: Number.NaN, travelFee: 0 }, { code: "B", label: "b", maxKm: null, travelFee: 0 }])).toMatch(/km/);
    const nine = Array.from({ length: 9 }, (_, i) => ({ code: `Z${i}`, label: `z${i}`, maxKm: i < 8 ? (i + 1) * 10 : null, travelFee: 0 }));
    expect(validateZones(nine)).toMatch(/8/);
  });
});

describe("zoneForKm", () => {
  it("uses km <= maxKm, open last zone, null for unknown", () => {
    expect(zoneForKm(DEFAULT_ZONES, 0)!.code).toBe("A");
    expect(zoneForKm(DEFAULT_ZONES, 10)!.code).toBe("A");
    expect(zoneForKm(DEFAULT_ZONES, 10.1)!.code).toBe("B");
    expect(zoneForKm(DEFAULT_ZONES, 999)!.code).toBe("D");
    expect(zoneForKm(DEFAULT_ZONES, null)).toBeNull();
    expect(zoneForKm(DEFAULT_ZONES, undefined)).toBeNull();
  });
});

describe("zoneFee / zoneLabel", () => {
  it("returns 0 and «χωρίς ζώνη» for unknown codes", () => {
    expect(zoneFee(DEFAULT_ZONES, "B")).toBe(15);
    expect(zoneFee(DEFAULT_ZONES, "Z")).toBe(0);
    expect(zoneFee(DEFAULT_ZONES, null)).toBe(0);
    expect(zoneLabel(DEFAULT_ZONES, "B")).toBe("Ζώνη Β");
    expect(zoneLabel(DEFAULT_ZONES, null)).toBe("χωρίς ζώνη");
  });
});

describe("formatDistance", () => {
  it("formats road, estimate and missing", () => {
    expect(formatDistance(23.4, 35, "ROAD")).toBe("23,4 km · περ. 35′");
    expect(formatDistance(23.4, null, "ESTIMATE")).toBe("≈ 23,4 km (εκτίμηση)");
    expect(formatDistance(null, null, null)).toBe("—");
  });
});

describe("summarizeZones", () => {
  it("counts per zone in zone order, unknown last", () => {
    expect(summarizeZones(DEFAULT_ZONES, ["B", null, "C", "B"])).toBe("Ζώνη Β ×2, Ζώνη Γ ×1, χωρίς ζώνη ×1");
  });
});

describe("describeBuildingDistance", () => {
  it("joins the formatted distance with the zone", () => {
    expect(describeBuildingDistance({ distanceKm: 23, distanceMinutes: 35, distanceMethod: "ROAD" }, DEFAULT_ZONES)).toBe("23 km · περ. 35′ · Ζώνη Β");
    expect(describeBuildingDistance({ distanceKm: 70, distanceMinutes: null, distanceMethod: "ESTIMATE" }, DEFAULT_ZONES)).toBe("≈ 70 km (εκτίμηση) · Ζώνη Δ");
    expect(describeBuildingDistance({ distanceKm: null, distanceMinutes: null, distanceMethod: null }, DEFAULT_ZONES)).toBeNull();
  });
});
