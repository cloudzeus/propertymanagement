import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({
  supplier: null as null | Record<string, unknown>,
  building: null as null | Record<string, unknown>,
  cached: vi.fn<() => Promise<{ km: number; minutes: number; method: "ROAD" | "ESTIMATE"; provider: "osrm" | "ors" | "haversine" }>>(),
}));
vi.mock("@/lib/db", () => ({ db: { supplier: { findUnique: vi.fn(async () => m.supplier) }, building: { findUnique: vi.fn(async () => m.building) } } }));
vi.mock("./cache", () => ({ cachedDistance: m.cached }));
vi.mock("./buildings", async () => {
  const { DEFAULT_ZONES } = await import("./zones");
  return { getDistanceZones: async () => DEFAULT_ZONES };
});

import { surveyDefault, supplierToBuilding } from "./suppliers";

beforeEach(() => {
  vi.clearAllMocks();
  m.supplier = { lat: 37.98, lng: 23.73, surveyZoneFees: { B: 10, C: 25 } };
  m.building = { lat: 38, lng: 23.8 };
  m.cached.mockResolvedValue({ km: 23, minutes: 35, method: "ROAD", provider: "osrm" });
});

describe("surveyDefault", () => {
  it("adds the zone fee to the base, null when neither applies", () => {
    expect(surveyDefault(30, { B: 10 }, "B")).toBe(40);
    expect(surveyDefault(null, { B: 10 }, "B")).toBe(10);
    expect(surveyDefault(null, null, "B")).toBeNull();
    expect(surveyDefault(30, { B: 10 }, null)).toBe(30);
    expect(surveyDefault(null, { B: 0 }, "B")).toBeNull();
    expect(surveyDefault(30, { B: "7,5" as unknown as number }, "B")).toBe(37.5);
  });
});

describe("supplierToBuilding", () => {
  it("returns null without coordinates on either side", async () => {
    m.supplier = { lat: null, lng: null, surveyZoneFees: null };
    expect(await supplierToBuilding("s1", "b1")).toBeNull();
    m.supplier = { lat: 37.98, lng: 23.73, surveyZoneFees: null };
    m.building = { lat: null, lng: null };
    expect(await supplierToBuilding("s1", "b1")).toBeNull();
    expect(m.cached).not.toHaveBeenCalled();
  });
  it("returns distance, zone and the supplier's fee for that zone", async () => {
    const r = await supplierToBuilding("s1", "b1");
    expect(m.cached).toHaveBeenCalledWith({ lat: 37.98, lng: 23.73 }, { lat: 38, lng: 23.8 });
    expect(r).toMatchObject({ km: 23, minutes: 35, method: "ROAD", zoneFee: 10 });
    expect(r?.zone?.code).toBe("B");
  });
  it("fee is 0 for a zone the supplier did not price", async () => {
    m.cached.mockResolvedValue({ km: 200, minutes: 150, method: "ESTIMATE", provider: "haversine" });
    const r = await supplierToBuilding("s1", "b1");
    expect(r).toMatchObject({ zoneFee: 0, method: "ESTIMATE" });
    expect(r?.zone?.code).toBe("D");
  });
});
