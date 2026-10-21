import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({
  actor: { id: "staff1", role: "MANAGER", perms: ["maintenance:view", "work-orders:view", "rfq:view", "rfq:create"] },
  managed: null as null | string[],
  fault: { id: "f1", title: "Διαρροή", status: "OPEN", handledBy: "COMPANY", assigneeId: null, supplierId: null, buildingId: "b1", categoryId: null, categoryName: null, restrictedAccess: false, estimatedMinutes: null, managerPresence: false, slots: [], appointments: [] } as Record<string, unknown> | null,
  building: { customerId: "c1" },
}));
vi.mock("@/lib/auth-effective", () => ({ getEffectiveSession: async () => ({ user: { id: m.actor.id, role: m.actor.role } }) }));
vi.mock("@/lib/rbac/permissions", () => ({ getEffectivePermissions: async () => ({ perms: new Set(m.actor.perms), role: m.actor.role }), can: (p: Set<string>, k: string, a: string) => p.has(`${k}:${a}`) }));
vi.mock("@/lib/work/queries", () => ({ managedCustomerIds: vi.fn(async () => m.managed), listAssignableEmployees: vi.fn(async () => [{ id: "e1", name: "Ε" }]) }));
vi.mock("@/lib/maintenance-requests", () => ({ loadFaultDetail: vi.fn(async () => m.fault) }));
vi.mock("@/lib/rfq", () => ({ loadRfqPanel: vi.fn(async () => ({ rfqs: [], workOrders: [], defaults: { markupPct: 15, warrantyMonths: 6 } })), woInclude: {}, workOrderToCompanyDTO: (w: { id: string; status: string }) => ({ id: w.id, status: w.status }) }));
vi.mock("@/lib/rfq-candidates", () => ({ listRfqCandidates: vi.fn(async () => ({ candidates: [{ id: "s1", name: "Σ", reasons: [] }], categories: [], defaultCategoryId: null })) }));
vi.mock("@/lib/supplier-ranking", () => ({ describeRank: (r: { name: string }) => r.name }));
vi.mock("@/lib/db", () => ({
  db: {
    building: { findUnique: vi.fn(async () => m.building) },
    workOrder: { findUnique: vi.fn(async () => ({ id: "w1", status: "ACCEPTED", maintenanceRequestId: "f1", buildingId: "b1", supplier: { name: "Σ" }, building: { name: "Κ" } })) },
    serviceRequest: { findUnique: vi.fn(async () => ({ id: "r1", maintenanceRequestId: "f1", buildingId: "b1" })) },
    buildingPreferredSupplier: { findMany: vi.fn(async () => [{ supplierId: "s1", categoryId: null }]) },
  },
}));

import { loadWorkActionContext } from "./work-actions";

beforeEach(() => { vi.clearAllMocks(); m.actor = { id: "staff1", role: "MANAGER", perms: ["maintenance:view", "work-orders:view", "rfq:view", "rfq:create"] }; m.managed = null; });

describe("loadWorkActionContext", () => {
  it("refuses non-company roles and missing module view permission", async () => {
    m.actor.role = "PROPERTY_ADMIN";
    expect(await loadWorkActionContext({ kind: "fault", id: "f1" })).toEqual({ error: "Δεν επιτρέπεται" });
    m.actor = { id: "staff1", role: "EMPLOYEE", perms: ["maintenance:view"] };
    expect(await loadWorkActionContext({ kind: "work-order", id: "w1" })).toEqual({ error: "Δεν επιτρέπεται" });
  });
  it("keeps a MANAGER inside the buildings of their account-managed customers", async () => {
    m.managed = ["c9"];
    expect(await loadWorkActionContext({ kind: "fault", id: "f1" })).toEqual({ error: "Εκτός εμβέλειας" });
    m.managed = ["c1"];
    const ctx = await loadWorkActionContext({ kind: "fault", id: "f1" });
    expect("error" in ctx).toBe(false);
  });
  it("loads the fault, employees, ranked suppliers with the preferred one, picker and RFQ panel for a manager", async () => {
    const ctx = await loadWorkActionContext({ kind: "fault", id: "f1" });
    if ("error" in ctx) throw new Error(ctx.error);
    expect(ctx.fault).toMatchObject({ id: "f1", status: "OPEN", handledBy: "COMPANY" });
    expect(ctx.employees).toEqual([{ id: "e1", name: "Ε" }]);
    expect(ctx.suppliers).toEqual([{ id: "s1", name: "Σ" }]);
    expect(ctx.preferredSupplierId).toBe("s1");
    expect(ctx.picker.candidates).toHaveLength(1);
    expect(ctx.defaults).toEqual({ markupPct: 15, warrantyMonths: 6 });
  });
  it("resolves a work order or an RFQ to its fault", async () => {
    const a = await loadWorkActionContext({ kind: "work-order", id: "w1" });
    expect(!("error" in a) && a.fault?.id).toBe("f1");
    const b = await loadWorkActionContext({ kind: "rfq", id: "r1" });
    expect(!("error" in b) && b.fault?.id).toBe("f1");
  });
  it("gives an EMPLOYEE no employees/suppliers but still the picker when rfq:create", async () => {
    m.actor = { id: "e", role: "EMPLOYEE", perms: ["maintenance:view", "rfq:view", "rfq:create"] };
    const ctx = await loadWorkActionContext({ kind: "fault", id: "f1" });
    if ("error" in ctx) throw new Error(ctx.error);
    expect(ctx.employees).toEqual([]);
    expect(ctx.suppliers).toEqual([]);
    expect(ctx.picker.candidates).toHaveLength(1);
  });
});
