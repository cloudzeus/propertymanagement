import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({ row: null as null | Record<string, unknown>, upserts: [] as unknown[] }));
vi.mock("@/lib/db", () => ({
  db: {
    distanceCache: {
      findUnique: vi.fn(async () => m.row),
      upsert: vi.fn(async (args: { create: Record<string, unknown> }) => { m.upserts.push(args); return args.create; }),
    },
  },
}));

import { cachedDistance, coordKey, peekCachedDistance } from "./cache";

const A = { lat: 37.98123456, lng: 23.73 };
const B = { lat: 38, lng: 23.8 };
const road = { km: 23.5, minutes: 35, method: "ROAD" as const, provider: "osrm" as const };
const est = { km: 10, minutes: 12, method: "ESTIMATE" as const, provider: "haversine" as const };

beforeEach(() => { m.row = null; m.upserts.length = 0; });

describe("coordKey", () => {
  it("rounds to 4 decimals as integers", () => expect(coordKey(A)).toEqual({ lat4: 379812, lng4: 237300 }));
});

describe("cachedDistance", () => {
  it("returns a ROAD hit without routing", async () => {
    m.row = { ...road, expiresAt: null };
    const route = vi.fn();
    expect(await cachedDistance(A, B, { route })).toEqual(road);
    expect(route).not.toHaveBeenCalled();
  });

  it("routes and upserts on miss, with expiresAt only for estimates", async () => {
    const now = new Date("2026-10-21T10:00:00Z");
    expect(await cachedDistance(A, B, { route: vi.fn(async () => road), now: () => now })).toEqual(road);
    const first = m.upserts[0] as { where: { fromLat4_fromLng4_toLat4_toLng4: Record<string, number> }; create: { expiresAt: Date | null; km: number } };
    expect(first.where.fromLat4_fromLng4_toLat4_toLng4).toEqual({ fromLat4: 379812, fromLng4: 237300, toLat4: 380000, toLng4: 238000 });
    expect(first.create.expiresAt).toBeNull();
    expect(first.create.km).toBe(23.5);
    await cachedDistance(A, B, { route: vi.fn(async () => est), now: () => now });
    expect((m.upserts[1] as { create: { expiresAt: Date } }).create.expiresAt.toISOString()).toBe("2026-10-22T10:00:00.000Z");
  });

  it("re-routes an expired estimate and on force", async () => {
    m.row = { ...est, expiresAt: new Date("2026-10-20T00:00:00Z") };
    const route = vi.fn(async () => road);
    expect(await cachedDistance(A, B, { route, now: () => new Date("2026-10-21T00:00:00Z") })).toEqual(road);
    m.row = { ...road, expiresAt: null };
    await cachedDistance(A, B, { route, force: true });
    expect(route).toHaveBeenCalledTimes(2);
  });

  it("keeps serving an unexpired estimate", async () => {
    m.row = { ...est, expiresAt: new Date("2026-10-22T00:00:00Z") };
    const route = vi.fn(async () => road);
    expect(await cachedDistance(A, B, { route, now: () => new Date("2026-10-21T00:00:00Z") })).toEqual(est);
    expect(route).not.toHaveBeenCalled();
  });
});

describe("peekCachedDistance", () => {
  it("returns the cached row (even an estimate) and null on miss, never routing", async () => {
    expect(await peekCachedDistance(A, B)).toBeNull();
    m.row = { ...est, expiresAt: new Date("2000-01-01T00:00:00Z") };
    expect(await peekCachedDistance(A, B)).toEqual(est);
  });
});
