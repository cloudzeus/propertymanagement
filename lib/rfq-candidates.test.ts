import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({
  users: [] as { id: string; email: string }[],
  contacts: [] as { id: string; email: string | null }[],
  supplier: { email: null as string | null, contactEmail: null as string | null },
}));
vi.mock("@/lib/db", () => ({
  db: {
    user: { findMany: vi.fn(async () => m.users) },
    supplierContact: { findMany: vi.fn(async () => m.contacts) },
    supplier: { findUnique: vi.fn(async () => m.supplier), findMany: vi.fn(async () => []) },
    maintenanceRequest: { findUnique: vi.fn(async () => null), findMany: vi.fn(async () => []) },
    buildingPreferredSupplier: { findMany: vi.fn(async () => []) },
    maintenanceCategory: { findMany: vi.fn(async () => []) },
  },
}));

import { recipientsForSupplier } from "./rfq-candidates";

beforeEach(() => { m.users = []; m.contacts = []; m.supplier = { email: null, contactEmail: null }; });

describe("recipientsForSupplier", () => {
  it("merges logins, RFQ contacts and the supplier's own addresses without duplicates, keeping ids of the first match", async () => {
    m.users = [{ id: "u1", email: "Admin@Firm.gr" }];
    m.contacts = [{ id: "c1", email: "admin@firm.gr" }, { id: "c2", email: "tech@firm.gr" }, { id: "c3", email: null }];
    m.supplier = { email: "INFO@firm.gr", contactEmail: "tech@firm.gr" };
    const r = await recipientsForSupplier("s1");
    expect(r).toEqual([
      { email: "admin@firm.gr", userId: "u1", contactId: null },
      { email: "tech@firm.gr", userId: null, contactId: "c2" },
      { email: "info@firm.gr", userId: null, contactId: null },
    ]);
  });
  it("is empty when the supplier has no address anywhere", async () => {
    expect(await recipientsForSupplier("s1")).toEqual([]);
  });
});
