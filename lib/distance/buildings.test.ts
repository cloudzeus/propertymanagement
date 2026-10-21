import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({
  base: null as null | { lat: number; lng: number; address: string; key: string },
  building: null as null | Record<string, unknown>,
  buildings: [] as Record<string, unknown>[],
  updates: [] as { id: string; data: Record<string, unknown> }[],
  settings: null as null | Record<string, unknown>,
  route: { km: 23, minutes: 35, method: "ROAD" as "ROAD" | "ESTIMATE", provider: "osrm" as "osrm" | "ors" | "haversine" },
  cached: vi.fn<(from: unknown, to: { lat: number }, opts?: unknown) => Promise<{ km: number; minutes: number; method: "ROAD" | "ESTIMATE"; provider: "osrm" | "ors" | "haversine" }>>(),
}));
vi.mock("@/lib/db", () => ({
  db: {
    building: {
      findUnique: vi.fn(async () => m.building),
      findMany: vi.fn(async () => m.buildings),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => { m.updates.push({ id: where.id, data }); return { id: where.id, ...data }; }),
    },
    appSettings: { findUnique: vi.fn(async () => m.settings) },
  },
}));
vi.mock("./base", () => ({ getBaseStation: vi.fn(async () => m.base) }));
vi.mock("./cache", () => ({ cachedDistance: m.cached }));

import { isStale, recomputeBuildingDistance, recomputeStaleBuildings, touchBuildingDistance, getDistanceZones } from "./buildings";
import { DEFAULT_ZONES } from "./zones";

const BASE = { lat: 37.98, lng: 23.73, address: "Αθηνάς 1", key: "379800,237300" };

beforeEach(() => {
  vi.clearAllMocks();
  m.base = BASE; m.building = { id: "b1", lat: 38, lng: 23.8 }; m.buildings = []; m.updates.length = 0; m.settings = null;
  m.route = { km: 23, minutes: 35, method: "ROAD", provider: "osrm" };
  m.cached.mockImplementation(async () => m.route);
});

describe("isStale", () => {
  it("stale when never computed, base changed or estimate", () => {
    expect(isStale({ distanceAt: null, distanceBaseKey: null, distanceMethod: null }, "k")).toBe(true);
    expect(isStale({ distanceAt: new Date(), distanceBaseKey: "old", distanceMethod: "ROAD" }, "k")).toBe(true);
    expect(isStale({ distanceAt: new Date(), distanceBaseKey: "k", distanceMethod: "ESTIMATE" }, "k")).toBe(true);
    expect(isStale({ distanceAt: new Date(), distanceBaseKey: "k", distanceMethod: "ROAD" }, "k")).toBe(false);
  });
});

describe("recomputeBuildingDistance", () => {
  it("clears the fields when there is no base", async () => {
    m.base = null;
    const r = await recomputeBuildingDistance("b1");
    expect(r).toEqual({ distanceKm: null, distanceMinutes: null, distanceMethod: null, distanceAt: null, distanceBaseKey: null });
    expect(m.updates[0]).toEqual({ id: "b1", data: r });
    expect(m.cached).not.toHaveBeenCalled();
  });
  it("clears the fields when the building has no coordinates", async () => {
    m.building = { id: "b1", lat: null, lng: 23.8 };
    expect((await recomputeBuildingDistance("b1")).distanceKm).toBeNull();
    expect(m.cached).not.toHaveBeenCalled();
  });
  it("writes km/minutes/method/at/baseKey from the cache", async () => {
    const r = await recomputeBuildingDistance("b1", { force: true });
    expect(m.cached).toHaveBeenCalledWith({ lat: 37.98, lng: 23.73 }, { lat: 38, lng: 23.8 }, { force: true });
    expect(r).toMatchObject({ distanceKm: 23, distanceMinutes: 35, distanceMethod: "ROAD", distanceBaseKey: "379800,237300" });
    expect(r.distanceAt).toBeInstanceOf(Date);
    expect(m.updates[0].data).toEqual(r);
  });
});

describe("recomputeStaleBuildings", () => {
  it("only touches stale rows up to the limit and counts estimates", async () => {
    m.buildings = [
      { id: "fresh", lat: 38, lng: 23.8, distanceAt: new Date(), distanceBaseKey: BASE.key, distanceMethod: "ROAD" },
      { id: "staleRoad", lat: 38, lng: 23.8, distanceAt: new Date(), distanceBaseKey: "old", distanceMethod: "ROAD" },
      { id: "staleEst", lat: 38.1, lng: 23.9, distanceAt: new Date(), distanceBaseKey: BASE.key, distanceMethod: "ESTIMATE" },
      { id: "never", lat: 38.2, lng: 23.9, distanceAt: null, distanceBaseKey: null, distanceMethod: null },
    ];
    m.cached.mockImplementation(async (_f, t) => (t.lat === 38.1 ? { ...m.route, method: "ESTIMATE" as const, provider: "haversine" as const } : m.route));
    // each recompute re-reads the building by id
    const byId = new Map(m.buildings.map((b) => [b.id as string, b]));
    const { db } = await import("@/lib/db");
    (db.building.findUnique as unknown as ReturnType<typeof vi.fn>).mockImplementation(async ({ where }: { where: { id: string } }) => byId.get(where.id) ?? null);

    expect(await recomputeStaleBuildings({ limit: 2 })).toEqual({ scanned: 4, updated: 2, estimated: 1, skipped: 2 });
    expect(m.updates.map((u) => u.id)).toEqual(["staleRoad", "staleEst"]);
  });
  it("skips everything when there is no base", async () => {
    m.base = null;
    m.buildings = [{ id: "x", lat: 38, lng: 23.8, distanceAt: null, distanceBaseKey: null, distanceMethod: null }];
    expect(await recomputeStaleBuildings()).toEqual({ scanned: 1, updated: 0, estimated: 0, skipped: 1 });
    expect(m.updates).toEqual([]);
  });
});

describe("touchBuildingDistance", () => {
  it("swallows errors", async () => {
    m.cached.mockRejectedValueOnce(new Error("boom"));
    await expect(touchBuildingDistance("b1")).resolves.toBeUndefined();
  });
});

describe("getDistanceZones", () => {
  it("parses AppSettings.distanceZones, defaults when null", async () => {
    expect(await getDistanceZones()).toEqual(DEFAULT_ZONES);
    m.settings = { distanceZones: [{ code: "X", label: "Χ", maxKm: null, travelFee: 5 }] };
    expect(await getDistanceZones()).toEqual([{ code: "X", label: "Χ", maxKm: null, travelFee: 5 }]);
  });
});

describe("cron registration", () => {
  it("has the base-distances job", async () => {
    vi.doMock("@/lib/notify", () => ({ notifyUsers: vi.fn(), supplierUserIds: vi.fn(), companyStaffIds: vi.fn(), buildingDeciderIds: vi.fn() }));
    vi.doMock("@/lib/mailgun", () => ({ sendNotificationEmail: vi.fn() }));
    vi.doMock("@/lib/maintenance", () => ({ pickReminderEmails: vi.fn(), isReminderDue: vi.fn() }));
    vi.doMock("@/lib/wallet/allowance", () => ({ runMonthlyAllowance: vi.fn() }));
    vi.doMock("@/lib/softone/sync/engine", () => ({ pullAllMasterData: vi.fn() }));
    vi.doMock("@/lib/rfq-shared", () => ({ addBusinessDays: vi.fn(), businessDaysUntil: vi.fn() }));
    const { CRON_JOBS } = await import("@/lib/cron/jobs");
    const job = CRON_JOBS.find((j) => j.key === "base-distances");
    expect(job?.schedule).toEqual({ kind: "daily", hour: 3 });
    expect(job?.label).toBe("Αποστάσεις από τη βάση");
  });
});
