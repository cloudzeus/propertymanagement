import { describe, it, expect, vi, beforeEach } from "vitest";

/* createBuildingWithUnits — building + units + precomputed millesimes in one transaction (super-admin). */

const m = vi.hoisted(() => ({
  role: "SUPER_ADMIN",
  created: [] as unknown[],
  createdUnits: [] as unknown[],
  updated: [] as unknown[],
  revalidated: [] as string[],
  events: [] as string[],
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
  };
  return {
    db: {
      user: { findUnique: vi.fn(async () => ({ role: m.role })) },
      property: { findUnique: vi.fn(async () => ({ companyId: "c1", customerId: "cu1" })) },
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

beforeEach(() => { vi.clearAllMocks(); m.role = "SUPER_ADMIN"; m.created = []; m.createdUnits = []; m.updated = []; m.revalidated = []; m.events = []; });

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
});
