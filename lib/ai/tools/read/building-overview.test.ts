import { describe, it, expect, vi } from "vitest";

const { access, resolve } = vi.hoisted(() => ({ access: vi.fn(), resolve: vi.fn() }));
vi.mock("@/lib/building-access", () => ({ getBuildingAccess: access }));
vi.mock("../resolve", () => ({ resolveBuilding: resolve }));
vi.mock("@/lib/db", () => ({
  db: {
    building: { findUnique: vi.fn(async () => ({ id: "b1", name: "Ερμού 5", address: "Ερμού 5", city: "Αθήνα", postalCode: "10563", floors: 5, hasElevator: true, property: { name: "Ερμού", managed: true }, _count: { units: 12 } })) },
    managementAssignment: { findMany: vi.fn(async () => [{ user: { name: "Γιάννης Δ." } }]) },
  },
}));

import { getBuildingOverview } from "./building-overview";
import type { AssistantCtx } from "../types";
import { beforeEach } from "vitest";

beforeEach(() => { resolve.mockReset(); resolve.mockImplementation(async (_c: unknown, q: { buildingId?: string }) => ({ id: q.buildingId ?? "b1", name: "Ερμού 5" })); });

const ctx = (role: string): AssistantCtx => ({
  user: { id: "u1", name: null, email: "e", role, customerId: null, companyId: null }, real: { id: "u1", role }, impersonating: false,
  surface: "customer", perms: new Set(), scope: { seesAllCustomers: false, managerBuildingIds: [], occupantUnits: [], supplierId: null }, page: { path: "/" }, now: new Date(),
});

describe("getBuildingOverview", () => {
  it("hides manager names from occupants", async () => {
    access.mockResolvedValue({ viewer: "occupant", managed: true, can: {} });
    const r = await getBuildingOverview.run({ buildingId: "b1" }, ctx("PROPERTY_OWNER"));
    expect(r.ok).toBe(true);
    const data = (r as { data: Record<string, unknown> }).data;
    expect(data.name).toBe("Ερμού 5");
    expect(data.unitsCount).toBe(12);
    expect(data).not.toHaveProperty("managerNames");
  });
  it("shows manager names to staff", async () => {
    access.mockResolvedValue({ viewer: "staff", managed: true, can: {} });
    const r = await getBuildingOverview.run({ buildingId: "b1" }, ctx("ADMIN"));
    expect((r as { data: { managerNames: string[] } }).data.managerNames).toEqual(["Γιάννης Δ."]);
  });
  it("denies a building the user cannot access", async () => {
    access.mockResolvedValue(null);
    expect(await getBuildingOverview.run({ buildingId: "b1" }, ctx("PROPERTY_OWNER"))).toEqual({ ok: false, error: "Δεν έχετε πρόσβαση" });
  });

  it("lets a collaborator (authorized by resolveBuilding) see the overview without manager names", async () => {
    access.mockResolvedValue(null);
    const r = await getBuildingOverview.run({ buildingId: "b1" }, { ...ctx("COLLABORATOR"), surface: "marketplace", scope: { seesAllCustomers: false, managerBuildingIds: [], occupantUnits: [], supplierId: "s1" } });
    expect(r.ok).toBe(true);
    expect((r as { data: Record<string, unknown> }).data).not.toHaveProperty("managerNames");
  });
  it("still denies a collaborator when resolveBuilding denies", async () => {
    resolve.mockResolvedValue({ error: "Δεν έχετε πρόσβαση" });
    expect(await getBuildingOverview.run({ buildingId: "b9" }, { ...ctx("COLLABORATOR"), scope: { seesAllCustomers: false, managerBuildingIds: [], occupantUnits: [], supplierId: "s1" } })).toEqual({ ok: false, error: "Δεν έχετε πρόσβαση" });
  });
});
