import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({ access: vi.fn(), bFindUnique: vi.fn(), bFindMany: vi.fn(async () => [] as unknown[]), canAccess: vi.fn(), mrFindMany: vi.fn(async () => [] as unknown[]), mrFindFirst: vi.fn(async () => null as unknown) }));
vi.mock("@/lib/db", () => ({ db: { building: { findUnique: m.bFindUnique, findMany: m.bFindMany }, maintenanceRequest: { findUnique: vi.fn(), findMany: m.mrFindMany, findFirst: m.mrFindFirst } } }));
vi.mock("@/lib/building-access", () => ({ getBuildingAccess: m.access }));
vi.mock("@/lib/maintenance-requests", () => ({ canAccessRequest: m.canAccess }));

import { resolveBuilding } from "./resolve";
import type { AssistantCtx } from "./types";

const unit = (buildingId: string, buildingName: string) => ({ unitId: "u-" + buildingId, unitNumber: "Α1", buildingId, buildingName, role: "RESIDENT" as const });
const ctx = (over: Partial<AssistantCtx> = {}, scope: Partial<AssistantCtx["scope"]> = {}): AssistantCtx => ({
  user: { id: "u1", name: null, email: "e", role: "PROPERTY_RESIDENT", customerId: "c1", companyId: null }, real: { id: "u1", role: "PROPERTY_RESIDENT" }, impersonating: false,
  surface: "customer", perms: new Set(), scope: { seesAllCustomers: false, managerBuildingIds: [], occupantUnits: [unit("b1", "Αθηνάς 3")], supplierId: null, ...scope }, page: { path: "/" }, now: new Date(), ...over,
});

beforeEach(() => { vi.clearAllMocks(); m.bFindMany.mockResolvedValue([]); m.mrFindMany.mockResolvedValue([]); m.mrFindFirst.mockResolvedValue(null); });

describe("resolveBuilding", () => {
  it("denies an explicit id the user cannot access", async () => {
    m.access.mockResolvedValue(null);
    expect(await resolveBuilding(ctx(), { buildingId: "foreign" })).toEqual({ error: "Δεν έχετε πρόσβαση" });
    expect(m.bFindUnique).not.toHaveBeenCalled();
  });
  it("does NOT fall back to another building when a given name matches nothing", async () => {
    const r = await resolveBuilding(ctx(), { buildingName: "Ερμού 5" });
    expect(r).toHaveProperty("error");
    expect((r as { error: string }).error).toContain("Ερμού 5");
  });
  it("asks which one when a name is ambiguous inside the user's scope", async () => {
    const c = ctx({}, { occupantUnits: [unit("b1", "Αθηνάς 3"), unit("b2", "Αθηνάς 30")] });
    const r = await resolveBuilding(c, { buildingName: "Αθηνάς" });
    expect((r as { error: string }).error).toMatch(/Βρήκα 2 κτήρια/);
  });
  it("prefers the (already authorized) page building, then a single-building scope", async () => {
    expect(await resolveBuilding(ctx({ page: { path: "/building/b9", buildingId: "b9", buildingName: "Σελίδα" } }), {})).toEqual({ id: "b9", name: "Σελίδα" });
    expect(await resolveBuilding(ctx(), {})).toEqual({ id: "b1", name: "Αθηνάς 3" });
  });
  it("asks for the building when staff give neither id nor name", async () => {
    expect(await resolveBuilding(ctx({ page: { path: "/admin" } }, { seesAllCustomers: true, occupantUnits: [] }), {})).toEqual({ error: "Σε ποιο κτήριο αναφέρεστε;" });
  });

  it("lets a collaborator resolve only buildings where their supplier has (had) work", async () => {
    const c = ctx({ user: { id: "u1", name: null, email: "e", role: "COLLABORATOR", customerId: null, companyId: null }, surface: "marketplace" }, { occupantUnits: [], supplierId: "s1" });
    m.access.mockResolvedValue(null);
    m.mrFindFirst.mockImplementation(async ({ where }: { where: { buildingId: string; supplierId: string } }) => (where.buildingId === "b7" && where.supplierId === "s1" ? { id: "r1" } : null));
    m.bFindUnique.mockResolvedValue({ id: "b7", name: "Σταδίου 1" });
    expect(await resolveBuilding(c, { buildingId: "b7" })).toEqual({ id: "b7", name: "Σταδίου 1" });
    expect(await resolveBuilding(c, { buildingId: "b8" })).toEqual({ error: "Δεν έχετε πρόσβαση" });
    m.mrFindMany.mockResolvedValue([{ building: { id: "b7", name: "Σταδίου 1" } }]);
    expect(await resolveBuilding(c, { buildingName: "σταδίου" })).toEqual({ id: "b7", name: "Σταδίου 1" });
    expect(await resolveBuilding(c, {})).toEqual({ id: "b7", name: "Σταδίου 1" });
  });
  it("gives a collaborator without a supplier no buildings at all", async () => {
    const c = ctx({ user: { id: "u1", name: null, email: "e", role: "COLLABORATOR", customerId: null, companyId: null }, surface: "marketplace" }, { occupantUnits: [], supplierId: null });
    expect(await resolveBuilding(c, { buildingId: "b7" })).toEqual({ error: "Δεν έχετε πρόσβαση" });
    expect(m.mrFindFirst).not.toHaveBeenCalled();
  });
});
