import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({
  db: { building: { findUnique: vi.fn() } },
}));
import { db } from "@/lib/db";
import { resolveCustomerId } from "./resolve-customer";

beforeEach(() => vi.clearAllMocks());

describe("resolveCustomerId", () => {
  it("returns explicit customerId directly", async () => {
    expect(await resolveCustomerId({ customerId: "c1" })).toBe("c1");
  });
  it("resolves customerId from a building's property", async () => {
    (db.building.findUnique as any).mockResolvedValue({ property: { customerId: "c9" } });
    expect(await resolveCustomerId({ buildingId: "b1" })).toBe("c9");
  });
  it("returns null when nothing resolves", async () => {
    (db.building.findUnique as any).mockResolvedValue(null);
    expect(await resolveCustomerId({ buildingId: "bX" })).toBeNull();
  });
});
