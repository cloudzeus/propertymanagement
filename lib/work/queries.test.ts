import { describe, it, expect, vi, beforeEach } from "vitest";

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn(async (_args: Record<string, unknown>) => [] as unknown[]) }));
vi.mock("@/lib/db", () => ({
  db: {
    maintenanceRequest: { findMany }, workOrder: { findMany }, serviceRequest: { findMany },
    recurringTask: { findMany }, maintenanceAppointment: { findMany },
  },
}));
vi.mock("@/lib/auth-effective", () => ({ getEffectiveSession: vi.fn() }));

import { loadWorkItems } from "./queries";

describe("loadWorkItems", () => {
  beforeEach(() => findMany.mockClear());
  it("orders every capped query so the first 500 rows are the most urgent, not an arbitrary subset", async () => {
    const items = await loadWorkItems({ role: "ADMIN", userId: "u", customerIds: null });
    expect(items).toEqual([]);
    expect(findMany).toHaveBeenCalledTimes(5);
    for (const call of findMany.mock.calls) {
      const args = call[0] as unknown as { take?: number; orderBy?: unknown };
      expect(args.take).toBe(500);
      expect(args.orderBy, JSON.stringify(args)).toBeDefined();
    }
  });
  it("scopes every query to the manager's customers", async () => {
    await loadWorkItems({ role: "MANAGER", userId: "u", customerIds: ["c1"] });
    for (const call of findMany.mock.calls) expect(JSON.stringify(call[0])).toContain('"customerId":{"in":["c1"]}');
  });
});
