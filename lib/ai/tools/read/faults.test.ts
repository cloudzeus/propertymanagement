import { describe, it, expect, vi, beforeEach } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
const { findMany, access } = vi.hoisted(() => ({ findMany: vi.fn(async (_q: any) => [] as unknown[]), access: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { maintenanceRequest: { findMany } } }));
vi.mock("@/lib/building-access", () => ({ getBuildingAccess: access }));

import { listFaults } from "./faults";
import type { AssistantCtx } from "../types";

const ctx = (role: string, extra: Partial<AssistantCtx["scope"]> = {}): AssistantCtx => ({
  user: { id: "u1", name: null, email: "e", role, customerId: null, companyId: null }, real: { id: "u1", role }, impersonating: false,
  surface: "customer", perms: new Set(),
  scope: { seesAllCustomers: role === "ADMIN", managerBuildingIds: [], occupantUnits: [{ unitId: "un1", unitNumber: "Α1", buildingId: "b1", buildingName: "Ερμού", role: "RESIDENT" }], supplierId: null, ...extra },
  page: { path: "/" }, now: new Date(),
});

beforeEach(() => { findMany.mockClear(); access.mockReset(); });

describe("listFaults", () => {
  it("scopes a resident to own reports plus common-area faults of their buildings", async () => {
    const r = await listFaults.run({}, ctx("PROPERTY_RESIDENT"));
    expect(r.ok).toBe(true);
    const where = findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([{ reportedById: "u1" }, { buildingId: { in: ["b1"] }, unitId: null }]);
  });
  it("refuses a building outside the resident's scope without querying", async () => {
    access.mockResolvedValue(null);
    const r = await listFaults.run({ buildingId: "foreign" }, ctx("PROPERTY_RESIDENT"));
    expect(r).toEqual({ ok: false, error: "Δεν έχετε πρόσβαση" });
    expect(findMany).not.toHaveBeenCalled();
  });
  it("scopes a collaborator to their supplier and staff to everything", async () => {
    await listFaults.run({}, ctx("COLLABORATOR", { occupantUnits: [], supplierId: "s1" }));
    expect(findMany.mock.calls[0][0].where).toEqual({ supplierId: "s1" });
    access.mockResolvedValue({ viewer: "staff", managed: true, can: {} });
    await listFaults.run({ buildingId: "b9", status: "OPEN" }, ctx("ADMIN", { occupantUnits: [] }));
    expect(findMany.mock.calls[1][0].where).toEqual({ buildingId: "b9", status: "OPEN" });
  });
});
