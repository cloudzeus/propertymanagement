import { describe, it, expect, vi, beforeEach } from "vitest";

const { access } = vi.hoisted(() => ({ access: vi.fn() }));
vi.mock("@/lib/building-access", () => ({ getBuildingAccess: access, managerBuildingIds: vi.fn(async () => ["mb1"]) }));
vi.mock("@/lib/rbac/permissions", () => ({ getEffectivePermissions: vi.fn(async () => ({ perms: new Set(["x:view"]), surface: "customer", roleId: null, role: "PROPERTY_OWNER" })) }));
vi.mock("@/lib/maintenance-requests", () => ({ canAccessRequest: vi.fn(async (_u: string, _r: string, id: string) => id === "ok-req") }));
vi.mock("@/lib/db", () => ({
  db: {
    unit: { findMany: vi.fn(async () => [{ id: "un1", unitNumber: "Α2", buildingId: "b1", ownerId: "u1", residentId: null, building: { name: "Ερμού 5" }, occupancies: [] }]) },
    user: { findUnique: vi.fn(async () => ({ supplierId: "s9" })) },
    building: { findUnique: vi.fn(async () => ({ name: "Ερμού 5" })) },
  },
}));

import { buildAssistantContext } from "./context";

const eff = (role: string, extra: Partial<{ impersonatorId: string | null }> = {}) => ({
  user: { id: "u1", role: role as any, roleId: null, companyId: null, customerId: "c1", name: "Μαρία", email: "m@x.gr" },
  real: { id: extra.impersonatorId ?? "u1", role: (extra.impersonatorId ? "SUPER_ADMIN" : role) as any },
  impersonatorId: extra.impersonatorId ?? null,
});

beforeEach(() => { access.mockReset(); });

describe("buildAssistantContext", () => {
  it("gives an owner their occupant units and no manager buildings", async () => {
    access.mockResolvedValue(null);
    const ctx = await buildAssistantContext(eff("PROPERTY_OWNER"), { path: "/owner" });
    expect(ctx.scope.occupantUnits).toEqual([{ unitId: "un1", unitNumber: "Α2", buildingId: "b1", buildingName: "Ερμού 5", role: "OWNER" }]);
    expect(ctx.scope.managerBuildingIds).toEqual([]);
    expect(ctx.scope.seesAllCustomers).toBe(false);
    expect(ctx.surface).toBe("customer");
    expect(ctx.perms.has("x:view")).toBe(true);
  });
  it("drops a page building id the user may not access and keeps an allowed one with its name", async () => {
    access.mockResolvedValueOnce(null);
    const denied = await buildAssistantContext(eff("PROPERTY_OWNER"), { path: "/building/zz", buildingId: "zz" });
    expect(denied.page.buildingId).toBeUndefined();
    access.mockResolvedValueOnce({ viewer: "occupant", managed: true, can: {} });
    const ok = await buildAssistantContext(eff("PROPERTY_OWNER"), { path: "/building/b1", buildingId: "b1" });
    expect(ok.page.buildingId).toBe("b1");
    expect(ok.page.buildingName).toBe("Ερμού 5");
  });
  it("keeps a request id only when canAccessRequest allows it", async () => {
    access.mockResolvedValue(null);
    expect((await buildAssistantContext(eff("PROPERTY_OWNER"), { path: "/portal/requests/ok-req", requestId: "ok-req" })).page.requestId).toBe("ok-req");
    expect((await buildAssistantContext(eff("PROPERTY_OWNER"), { path: "/portal/requests/bad", requestId: "bad" })).page.requestId).toBeUndefined();
  });
  it("marks impersonation and resolves manager buildings / supplier per role", async () => {
    access.mockResolvedValue(null);
    const imp = await buildAssistantContext(eff("PROPERTY_ADMIN", { impersonatorId: "sa" }), { path: "/building" });
    expect(imp.impersonating).toBe(true);
    expect(imp.real.id).toBe("sa");
    expect(imp.scope.managerBuildingIds).toEqual(["mb1"]);
    const col = await buildAssistantContext(eff("COLLABORATOR"), { path: "/marketplace" });
    expect(col.scope.supplierId).toBe("s9");
    expect(col.surface).toBe("marketplace");
    const staff = await buildAssistantContext(eff("ADMIN"), { path: "/admin" });
    expect(staff.scope.seesAllCustomers).toBe(true);
    expect(staff.scope.occupantUnits).toEqual([]);
  });
});
