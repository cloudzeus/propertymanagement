import { describe, it, expect, vi, beforeEach } from "vitest";

/* applyMillesimesSetup — the «Χιλιοστά βήμα-βήμα» wizard writes all three sets + elevator params + heating basis in one transaction. */

const m = vi.hoisted(() => ({
  unitUpdates: [] as { where: { id: string }; data: Record<string, unknown> }[],
  buildingUpdates: [] as unknown[],
  overrideUpserts: [] as unknown[],
  overrideDeletes: [] as unknown[],
  heatingCat: { id: "cat-heat", defaultTenantPct: 100, defaultOwnerPct: 0 } as { id: string; defaultTenantPct: number; defaultOwnerPct: number } | null,
  events: [] as string[],
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/building-access", () => ({ requireBuildingCap: vi.fn() }));
vi.mock("@/lib/realtime/bus", () => ({ publishBuildingEvent: (id: string, kind: string) => { m.events.push(`${id}:${kind}`); } }));
vi.mock("@/lib/db", () => {
  const tx = {
    unit: { update: vi.fn(async (args: { where: { id: string }; data: Record<string, unknown> }) => { m.unitUpdates.push(args); return {}; }) },
    building: { update: vi.fn(async (args: unknown) => { m.buildingUpdates.push(args); return {}; }) },
    buildingCategoryOverride: {
      upsert: vi.fn(async (args: unknown) => { m.overrideUpserts.push(args); return {}; }),
      deleteMany: vi.fn(async (args: unknown) => { m.overrideDeletes.push(args); return { count: 1 }; }),
    },
    expenseCategory: { findFirst: vi.fn(async () => m.heatingCat) },
  };
  return {
    db: {
      building: { findUnique: vi.fn(async () => ({ id: "b1", propertyId: "p1", units: [{ id: "a", areaSqm: 50, floor: 0 }, { id: "b", areaSqm: 100, floor: 1 }, { id: "c", areaSqm: 100, floor: 2 }] })) },
      $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    },
  };
});

import { applyMillesimesSetup } from "./building-millesimes";

beforeEach(() => { vi.clearAllMocks(); m.unitUpdates = []; m.buildingUpdates = []; m.overrideUpserts = []; m.overrideDeletes = []; m.events = []; m.heatingCat = { id: "cat-heat", defaultTenantPct: 100, defaultOwnerPct: 0 }; });

const byId = (id: string) => m.unitUpdates.find((u) => u.where.id === id)!.data;

describe("applyMillesimesSetup", () => {
  it("writes AUTO sources for computed values and MANUAL for given ones", async () => {
    const res = await applyMillesimesSetup("b1", {
      general: [{ unitId: "a", value: 100 }, { unitId: "b", value: 450 }, { unitId: "c", value: 450 }],
      elevator: { enabled: true, surchargePerFloor: 0.1, exemptGroundFloor: true, manual: null },
      heating: { basis: "HEATING_MILLESIMES", manual: null },
    });
    expect(res).toEqual({ ok: true, updated: 3 });
    expect(byId("b")).toMatchObject({ millesimes: 450, millesimesSource: "MANUAL", millesimesElevatorSource: "AUTO", millesimesHeatingSource: "AUTO" });
    expect(byId("a").millesimesElevator).toBe(0);
    expect(Math.round((byId("a").millesimesHeating as number) + (byId("b").millesimesHeating as number) + (byId("c").millesimesHeating as number))).toBe(1000);
    expect(m.buildingUpdates[0]).toMatchObject({ where: { id: "b1" }, data: { elevatorSurchargePerFloor: 0.1, elevatorExemptGroundFloor: true } });
    expect(m.overrideDeletes).toHaveLength(1); // HEATING_MILLESIMES = category default → override removed
    expect(m.events).toContain("b1:unit");
  });
  it("elevator disabled clears elevator millesimes", async () => {
    await applyMillesimesSetup("b1", { general: "AUTO", elevator: { enabled: false, surchargePerFloor: 0.1, exemptGroundFloor: true, manual: null }, heating: { basis: "NONE", manual: null } });
    expect(m.unitUpdates.every((u) => u.data.millesimesElevator === null && u.data.millesimesHeating === null)).toBe(true);
    expect(byId("b")).toMatchObject({ millesimes: 400, millesimesSource: "AUTO" });
  });
  it("metered heating sets the 70/30 override on the heating category", async () => {
    await applyMillesimesSetup("b1", { general: "AUTO", elevator: { enabled: false, surchargePerFloor: 0.1, exemptGroundFloor: true, manual: null }, heating: { basis: "METERED_70_30", manual: null } });
    expect(m.overrideUpserts[0]).toMatchObject({ where: { buildingId_categoryId: { buildingId: "b1", categoryId: "cat-heat" } }, create: { distributionBasis: "METERED_70_30", tenantPct: 100, ownerPct: 0 }, update: { distributionBasis: "METERED_70_30" } });
  });
  it("rejects manual sets that do not sum to 1000", async () => {
    const res = await applyMillesimesSetup("b1", { general: [{ unitId: "a", value: 100 }, { unitId: "b", value: 100 }, { unitId: "c", value: 100 }], elevator: { enabled: false, surchargePerFloor: 0.1, exemptGroundFloor: true, manual: null }, heating: { basis: "NONE", manual: null } });
    expect(res).toEqual({ error: expect.stringContaining("Λείπουν") });
    expect(m.unitUpdates).toHaveLength(0);
  });
  it("rejects negative cells and duplicate unit ids", async () => {
    const plan = (general: { unitId: string; value: number }[]) => ({ general, elevator: { enabled: false, surchargePerFloor: 0.1, exemptGroundFloor: true, manual: null }, heating: { basis: "NONE" as const, manual: null } });
    expect(await applyMillesimesSetup("b1", plan([{ unitId: "a", value: -100 }, { unitId: "b", value: 600 }, { unitId: "c", value: 500 }]))).toEqual({ error: expect.stringContaining("αρνητικ") });
    expect(await applyMillesimesSetup("b1", plan([{ unitId: "a", value: 500 }, { unitId: "a", value: 500 }]))).toEqual({ error: expect.stringContaining("δύο φορές") });
    expect(m.unitUpdates).toHaveLength(0);
  });
  it("saves hasElevator with the elevator parameters", async () => {
    await applyMillesimesSetup("b1", { general: "AUTO", elevator: { enabled: true, surchargePerFloor: 0.2, exemptGroundFloor: false, manual: null }, heating: { basis: "NONE", manual: null } });
    expect(m.buildingUpdates[0]).toMatchObject({ data: { hasElevator: true, elevatorSurchargePerFloor: 0.2, elevatorExemptGroundFloor: false } });
  });
});
