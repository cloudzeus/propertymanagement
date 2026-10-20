import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({ resolve: vi.fn(), requireView: vi.fn(), findMany: vi.fn(async () => [] as unknown[]) }));
vi.mock("@/lib/db", () => ({ db: { recurringTask: { findMany: m.findMany } } }));
vi.mock("@/lib/building-access", () => ({ requireBuildingView: m.requireView }));
vi.mock("../resolve", () => ({ resolveBuilding: m.resolve }));

import { listCalendarTasks } from "./calendar-tasks";
import type { AssistantCtx } from "../types";

const ctx = (role: string, supplierId: string | null = null): AssistantCtx => ({
  user: { id: "u1", name: null, email: "e", role, customerId: null, companyId: null }, real: { id: "u1", role }, impersonating: false,
  surface: role === "COLLABORATOR" ? "marketplace" : "customer", perms: new Set(), scope: { seesAllCustomers: false, managerBuildingIds: [], occupantUnits: [], supplierId }, page: { path: "/" }, now: new Date(),
});

beforeEach(() => { vi.clearAllMocks(); m.resolve.mockResolvedValue({ id: "b1", name: "Ερμού" }); m.findMany.mockResolvedValue([{ id: "t1", title: "Ασανσέρ", frequency: "MONTHLY", nextDueDate: new Date("2026-11-01"), kind: null, vendor: null }]); });

describe("listCalendarTasks", () => {
  it("lists a building's tasks for an occupant after the view guard passes", async () => {
    m.requireView.mockResolvedValue({ userId: "u1" });
    const r = await listCalendarTasks.run({ buildingId: "b1" }, ctx("PROPERTY_OWNER"));
    expect(r).toMatchObject({ ok: true, data: [{ id: "t1", frequency: "μηνιαία", nextDueDate: "2026-11-01" }] });
  });
  it("denies when the view guard throws", async () => {
    m.requireView.mockRejectedValue(new Error("Forbidden"));
    expect(await listCalendarTasks.run({ buildingId: "b1" }, ctx("PROPERTY_OWNER"))).toEqual({ ok: false, error: "Δεν έχετε πρόσβαση" });
  });
  it("lets a collaborator read the schedule of a building resolveBuilding authorized (the view guard knows no suppliers)", async () => {
    m.requireView.mockRejectedValue(new Error("Forbidden"));
    const r = await listCalendarTasks.run({ buildingId: "b1" }, ctx("COLLABORATOR", "s1"));
    expect(r.ok).toBe(true);
    expect(m.requireView).not.toHaveBeenCalled();
  });
});
