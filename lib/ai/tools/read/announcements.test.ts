import { describe, it, expect, vi, beforeEach } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
const m = vi.hoisted(() => ({ resolve: vi.fn(), findMany: vi.fn(async (_q: any) => [] as unknown[]), bFindUnique: vi.fn(async () => ({ propertyId: "p1" })) }));
vi.mock("@/lib/db", () => ({ db: { announcement: { findMany: m.findMany }, building: { findUnique: m.bFindUnique } } }));
vi.mock("../resolve", () => ({ resolveBuilding: m.resolve }));

import { listAnnouncements } from "./announcements";
import type { AssistantCtx } from "../types";

const ctx = (role: string, scope: Partial<AssistantCtx["scope"]> = {}): AssistantCtx => ({
  user: { id: "u1", name: null, email: "e", role, customerId: "c1", companyId: null }, real: { id: "u1", role }, impersonating: false,
  surface: "customer", perms: new Set(), scope: { seesAllCustomers: false, managerBuildingIds: [], occupantUnits: [{ unitId: "un1", unitNumber: "Α1", buildingId: "b1", buildingName: "Ερμού", role: "RESIDENT" }], supplierId: null, ...scope },
  page: { path: "/" }, now: new Date(),
});

beforeEach(() => { vi.clearAllMocks(); m.resolve.mockResolvedValue({ id: "b1", name: "Ερμού" }); m.bFindUnique.mockResolvedValue({ propertyId: "p1" }); });

describe("listAnnouncements", () => {
  it("includes multi-building announcements (buildingId null) targeted at the building, its property or the occupant's unit", async () => {
    await listAnnouncements.run({ buildingId: "b1" }, ctx("PROPERTY_RESIDENT"));
    const where = m.findMany.mock.calls[0]![0].where;
    expect(where.status).toEqual({ not: "DRAFT" });
    expect(where.recipients).toEqual({ some: { userId: "u1" } });
    expect(where.OR).toEqual([
      { buildingId: "b1" },
      { buildingId: null, targets: { some: { OR: [{ scopeType: "BUILDING", scopeId: "b1" }, { scopeType: "PROPERTY", scopeId: "p1" }, { scopeType: "UNIT", scopeId: { in: ["un1"] } }] } } },
    ]);
  });
  it("does not restrict managers to recipients but still finds multi-building ones through targets", async () => {
    await listAnnouncements.run({ buildingId: "b1" }, ctx("PROPERTY_ADMIN", { managerBuildingIds: ["b1"], occupantUnits: [] }));
    const where = m.findMany.mock.calls[0]![0].where;
    expect(where.recipients).toBeUndefined();
    expect(where.OR[1]).toEqual({ buildingId: null, targets: { some: { OR: [{ scopeType: "BUILDING", scopeId: "b1" }, { scopeType: "PROPERTY", scopeId: "p1" }] } } });
  });
  it("returns the resolver's error untouched", async () => {
    m.resolve.mockResolvedValue({ error: "Σε ποιο κτήριο αναφέρεστε;" });
    expect(await listAnnouncements.run({}, ctx("PROPERTY_RESIDENT"))).toEqual({ ok: false, error: "Σε ποιο κτήριο αναφέρεστε;" });
    expect(m.findMany).not.toHaveBeenCalled();
  });
});
