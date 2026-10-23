import { describe, it, expect, vi, beforeEach } from "vitest";

/* createBuildingWithUnits — building + units + precomputed millesimes in one transaction (super-admin). */

const m = vi.hoisted(() => ({
  role: "SUPER_ADMIN",
  created: [] as unknown[],
  createdUnits: [] as unknown[],
  updated: [] as unknown[],
  revalidated: [] as string[],
  events: [] as string[],
  existing: [] as { id: string; _count: { units: number } }[],
  overrideUpserts: [] as unknown[],
}));
vi.mock("@/auth", () => ({ auth: async () => ({ user: { id: "u1" } }) }));
vi.mock("@/lib/rbac/permissions", () => ({ getEffectivePermissions: async () => null, can: () => false }));
vi.mock("next/cache", () => ({ revalidatePath: (p: string) => { m.revalidated.push(p); } }));
vi.mock("@/lib/bunnycdn", () => ({ ensureFolder: vi.fn(), buildingFolder: vi.fn(() => "f") }));
vi.mock("@/lib/building-access", () => ({ requireBuildingCap: vi.fn() }));
vi.mock("@/lib/realtime/bus", () => ({ publishBuildingEvent: (id: string, kind: string) => { m.events.push(`${id}:${kind}`); } }));
vi.mock("@/lib/distance/buildings", () => ({ touchBuildingDistance: vi.fn(), recomputeBuildingDistance: vi.fn(), getDistanceZones: async () => [] }));
vi.mock("@/lib/db", () => {
  const tx = {
    building: {
      create: vi.fn(async (args: { data: unknown }) => { m.created.push(args.data); return { id: "b-new" }; }),
      update: vi.fn(async (args: unknown) => { m.updated.push(args); return {}; }),
    },
    unit: { createMany: vi.fn(async (args: { data: unknown[] }) => { m.createdUnits.push(...args.data); return { count: args.data.length }; }) },
    expenseCategory: { findFirst: vi.fn(async () => ({ id: "cat-heat", defaultTenantPct: 100, defaultOwnerPct: 0 })) },
    buildingCategoryOverride: { upsert: vi.fn(async (args: unknown) => { m.overrideUpserts.push(args); return {}; }) },
  };
  return {
    db: {
      user: { findUnique: vi.fn(async () => ({ role: m.role })) },
      property: { findUnique: vi.fn(async () => ({ companyId: "c1", customerId: "cu1" })) },
      building: { findMany: vi.fn(async () => m.existing) },
      $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    },
  };
});

import { createBuildingWithUnits } from "./buildings";

const building = { name: "Κτήριο Α", address: "Σόλωνος 12", city: "Αθήνα", postalCode: "10673", country: "Ελλάδα", floors: 2, basements: 0, hasElevator: true, hasBoiler: true, hasFireSafety: false, elevatorSurchargePerFloor: 0.1, elevatorExemptGroundFloor: true, heatingShared: true };
const units = [
  { unitNumber: "Κ1", floor: 0, areaSqm: 50, unitType: "SHOP" as const },
  { unitNumber: "1Α", floor: 1, areaSqm: 100, unitType: "APARTMENT" as const },
  { unitNumber: "2Α", floor: 2, areaSqm: 100, unitType: "APARTMENT" as const },
];

beforeEach(() => { vi.clearAllMocks(); m.role = "SUPER_ADMIN"; m.created = []; m.createdUnits = []; m.updated = []; m.revalidated = []; m.events = []; m.existing = []; m.overrideUpserts = []; });

describe("createBuildingWithUnits", () => {
  it("rejects duplicate unit numbers and an empty unit list", async () => {
    expect(await createBuildingWithUnits("p1", building, [units[0], { ...units[1], unitNumber: "Κ1" }])).toEqual({ error: expect.stringContaining("Κ1") });
    expect(await createBuildingWithUnits("p1", building, [])).toEqual({ error: expect.stringContaining("μονάδα") });
    expect(m.created).toHaveLength(0);
  });
  it("creates the building then the units with computed millesimes in one transaction", async () => {
    const res = await createBuildingWithUnits("p1", building, units);
    expect(res).toEqual({ buildingId: "b-new" });
    expect(m.created[0]).toMatchObject({ companyId: "c1", customerId: "cu1", propertyId: "p1", name: "Κτήριο Α", hasElevator: true, elevatorSurchargePerFloor: 0.1, elevatorExemptGroundFloor: true });
    expect(m.createdUnits).toHaveLength(3);
    const rows = m.createdUnits as { unitNumber: string; buildingId: string; customerId: string; millesimes: number | null; millesimesElevator: number | null; millesimesHeating: number | null }[];
    expect(rows.every((r) => r.buildingId === "b-new" && r.customerId === "cu1")).toBe(true);
    expect(Math.round(rows.reduce((s, r) => s + (r.millesimes ?? 0), 0))).toBe(1000);
    expect(rows.find((r) => r.unitNumber === "Κ1")!.millesimesElevator).toBe(0);
    expect(Math.round(rows.reduce((s, r) => s + (r.millesimesHeating ?? 0), 0))).toBe(1000);
    expect(m.updated[0]).toMatchObject({ where: { id: "b-new" }, data: { unitsCount: 3 } });
    expect(m.revalidated).toContain("/super-admin/properties/p1");
    expect(m.events).toContain("b-new:unit");
  });
  it("individual heating leaves heating millesimes null", async () => {
    await createBuildingWithUnits("p1", { ...building, heatingShared: false }, units);
    const rows = m.createdUnits as { millesimesHeating: number | null }[];
    expect(rows.every((r) => r.millesimesHeating === null)).toBe(true);
  });
  it("throws for non super-admins", async () => {
    m.role = "ADMIN";
    await expect(createBuildingWithUnits("p1", building, units)).rejects.toThrow("Forbidden");
  });
  it("fills the property's single empty default building instead of creating a second one", async () => {
    m.existing = [{ id: "b-default", _count: { units: 0 } }];
    const res = await createBuildingWithUnits("p1", building, units);
    expect(res).toEqual({ buildingId: "b-default" });
    expect(m.created).toHaveLength(0);
    expect(m.updated[0]).toMatchObject({ where: { id: "b-default" }, data: { name: "Κτήριο Α", address: "Σόλωνος 12", hasElevator: true } });
    expect((m.createdUnits as { buildingId: string }[]).every((r) => r.buildingId === "b-default")).toBe(true);
  });
  it("creates a new building when the existing ones already have units or there are several", async () => {
    m.existing = [{ id: "b-old", _count: { units: 4 } }];
    expect(await createBuildingWithUnits("p1", building, units)).toEqual({ buildingId: "b-new" });
    m.existing = [{ id: "b-1", _count: { units: 0 } }, { id: "b-2", _count: { units: 0 } }];
    expect(await createBuildingWithUnits("p1", building, units)).toEqual({ buildingId: "b-new" });
    expect(m.created).toHaveLength(2);
  });
  it("metered (70/30) heating writes the override on the heating category in the same transaction", async () => {
    await createBuildingWithUnits("p1", { ...building, heatingType: "AUTONOMOUS" }, units);
    expect(m.overrideUpserts[0]).toMatchObject({ where: { buildingId_categoryId: { buildingId: "b-new", categoryId: "cat-heat" } }, create: { distributionBasis: "METERED_70_30" }, update: { distributionBasis: "METERED_70_30" } });
    const rows = m.createdUnits as { millesimesHeating: number | null }[];
    expect(Math.round(rows.reduce((s, r) => s + (r.millesimesHeating ?? 0), 0))).toBe(1000);
    m.overrideUpserts = [];
    await createBuildingWithUnits("p1", { ...building, heatingType: "CENTRAL" }, units);
    expect(m.overrideUpserts).toHaveLength(0);
  });
  it("rejects a negative area, an unknown unit type and an absurd floor", async () => {
    expect(await createBuildingWithUnits("p1", building, [{ ...units[1], areaSqm: -5 }])).toEqual({ error: expect.stringContaining("τετραγωνικά") });
    expect(await createBuildingWithUnits("p1", building, [{ ...units[1], unitType: "VILLA" as never }])).toEqual({ error: expect.stringContaining("τύπος") });
    expect(await createBuildingWithUnits("p1", building, [{ ...units[1], floor: 400 }])).toEqual({ error: expect.stringContaining("όροφος") });
    expect(m.created).toHaveLength(0);
  });
});
