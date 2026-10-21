import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({
  perms: ["settings-distance:view", "settings-distance:edit"],
  upsert: vi.fn(async () => ({})),
  buildings: [] as Record<string, unknown>[],
  base: { lat: 37.98, lng: 23.73, address: "Αθηνάς 1", key: "379800,237300" } as null | { lat: number; lng: number; address: string; key: string },
  recompute: vi.fn(async () => ({ scanned: 3, updated: 2, estimated: 1, skipped: 1 })),
}));
vi.mock("@/lib/rbac/permissions", () => ({
  getEffectivePermissions: async () => ({ perms: new Set(m.perms), role: "ADMIN" }),
  can: (p: Set<string>, k: string, a: string) => p.has(`${k}:${a}`),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/db", () => ({
  db: {
    appSettings: { upsert: m.upsert, findUnique: vi.fn(async () => ({ distanceZones: null })) },
    building: { findMany: vi.fn(async () => m.buildings) },
    company: { findFirst: vi.fn(async () => ({ id: "c1" })) },
  },
}));
vi.mock("@/lib/distance/base", () => ({ getBaseStation: vi.fn(async () => m.base) }));
vi.mock("@/lib/distance/buildings", async (orig) => {
  const real = await orig<typeof import("@/lib/distance/buildings")>();
  const { DEFAULT_ZONES } = await import("@/lib/distance/zones");
  return { ...real, recomputeStaleBuildings: m.recompute, getDistanceZones: async () => DEFAULT_ZONES };
});

import { saveDistanceZones, recomputeAllDistances, loadDistanceOverview } from "./distance-settings";
import { DEFAULT_ZONES } from "@/lib/distance/zones";

beforeEach(() => { vi.clearAllMocks(); m.perms = ["settings-distance:view", "settings-distance:edit"]; m.buildings = []; });

describe("saveDistanceZones", () => {
  it("rejects invalid zones without writing", async () => {
    expect(await saveDistanceZones([])).toEqual({ error: "Χρειάζεται τουλάχιστον μία ζώνη" });
    expect(m.upsert).not.toHaveBeenCalled();
  });
  it("writes valid zones", async () => {
    expect(await saveDistanceZones(DEFAULT_ZONES)).toEqual({ ok: true });
    expect(m.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: { distanceZones: DEFAULT_ZONES } }));
  });
  it("coerces numeric strings from the form and trims labels", async () => {
    const raw = [{ code: " A ", label: " Κοντά ", maxKm: "10", travelFee: "15,5" }, { code: "B", label: "Μακριά", maxKm: "", travelFee: "" }] as never;
    expect(await saveDistanceZones(raw)).toEqual({ ok: true });
    expect(m.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: { distanceZones: [
      { code: "A", label: "Κοντά", maxKm: 10, travelFee: 15.5 }, { code: "B", label: "Μακριά", maxKm: null, travelFee: 0 },
    ] } }));
  });
  it("refuses without the edit permission", async () => {
    m.perms = ["settings-distance:view"];
    expect(await saveDistanceZones(DEFAULT_ZONES)).toEqual({ error: "Δεν επιτρέπεται" });
  });
});

describe("recomputeAllDistances", () => {
  it("recomputes only stale buildings (cache hits cost nothing) and returns the counts", async () => {
    expect(await recomputeAllDistances()).toEqual({ ok: true, result: { scanned: 3, updated: 2, estimated: 1, skipped: 1 } });
    expect(m.recompute).toHaveBeenCalledWith({ force: false, limit: 300 });
  });
});

describe("loadDistanceOverview", () => {
  it("counts buildings per zone, missing, estimated and stale", async () => {
    m.buildings = [
      { distanceKm: 23, distanceAt: new Date("2026-10-20T00:00:00Z"), distanceBaseKey: "379800,237300", distanceMethod: "ROAD" },
      { distanceKm: 5, distanceAt: new Date("2026-10-19T00:00:00Z"), distanceBaseKey: "old", distanceMethod: "ROAD" },
      { distanceKm: 70, distanceAt: new Date("2026-10-21T00:00:00Z"), distanceBaseKey: "379800,237300", distanceMethod: "ESTIMATE" },
      { distanceKm: null, distanceAt: null, distanceBaseKey: null, distanceMethod: null },
    ];
    const o = await loadDistanceOverview();
    expect(o.base?.address).toBe("Αθηνάς 1");
    expect(o.zones).toEqual(DEFAULT_ZONES);
    expect(o.perZone).toEqual([{ code: "A", label: "Ζώνη Α", count: 1 }, { code: "B", label: "Ζώνη Β", count: 1 }, { code: "C", label: "Ζώνη Γ", count: 0 }, { code: "D", label: "Ζώνη Δ", count: 1 }]);
    expect(o).toMatchObject({ total: 4, missing: 1, estimated: 1, stale: 3, lastComputedAt: "2026-10-21T00:00:00.000Z", companyId: "c1" });
  });
});
