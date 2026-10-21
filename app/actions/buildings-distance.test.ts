import { describe, it, expect, vi, beforeEach } from "vitest";

/* recomputeBuildingDistanceAction — gated by properties:edit (not SUPER_ADMIN only). */

const m = vi.hoisted(() => ({
  perms: ["properties:edit"] as string[],
  recompute: vi.fn(async () => ({ distanceKm: 23, distanceMinutes: 35, distanceMethod: "ROAD", distanceAt: new Date(), distanceBaseKey: "k" })),
  revalidated: [] as string[],
}));
vi.mock("@/auth", () => ({ auth: async () => ({ user: { id: "u1" } }) }));
vi.mock("@/lib/rbac/permissions", () => ({
  getEffectivePermissions: async () => (m.perms.length ? { perms: new Set(m.perms), role: "ADMIN" } : null),
  can: (p: Set<string>, k: string, a: string) => p.has(`${k}:${a}`),
}));
vi.mock("next/cache", () => ({ revalidatePath: (p: string) => { m.revalidated.push(p); } }));
vi.mock("@/lib/bunnycdn", () => ({ ensureFolder: vi.fn(), buildingFolder: vi.fn() }));
vi.mock("@/lib/building-access", () => ({ requireBuildingCap: vi.fn() }));
vi.mock("@/lib/realtime/bus", () => ({ publishBuildingEvent: () => {} }));
vi.mock("@/lib/distance/buildings", async () => {
  const { DEFAULT_ZONES } = await import("@/lib/distance/zones");
  return { touchBuildingDistance: vi.fn(), recomputeBuildingDistance: m.recompute, getDistanceZones: async () => DEFAULT_ZONES };
});
vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: vi.fn(async () => ({ role: "ADMIN" })) },
    building: { findUnique: vi.fn(async () => ({ propertyId: "p1" })) },
  },
}));

import { recomputeBuildingDistanceAction } from "./buildings";

beforeEach(() => { vi.clearAllMocks(); m.perms = ["properties:edit"]; m.revalidated = []; });

describe("recomputeBuildingDistanceAction", () => {
  it("recomputes and returns the Greek badge for a user with properties:edit", async () => {
    expect(await recomputeBuildingDistanceAction("b1")).toEqual({ ok: true, label: "23 km · περ. 35′ · Ζώνη Β" });
    expect(m.recompute).toHaveBeenCalledWith("b1", { force: true });
    expect(m.revalidated).toContain("/super-admin/properties/p1");
  });
  it("returns {error} instead of throwing without properties:edit", async () => {
    m.perms = ["properties:view"];
    expect(await recomputeBuildingDistanceAction("b1")).toEqual({ error: "Δεν επιτρέπεται" });
    expect(m.recompute).not.toHaveBeenCalled();
  });
  it("returns {error} when there is no session", async () => {
    m.perms = [];
    expect(await recomputeBuildingDistanceAction("b1")).toEqual({ error: "Δεν επιτρέπεται" });
  });
});
