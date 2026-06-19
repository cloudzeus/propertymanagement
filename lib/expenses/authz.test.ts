import { describe, it, expect, vi, beforeEach } from "vitest";

const findUnique = vi.fn();
const findFirst = vi.fn();
vi.mock("@/lib/db", () => ({ db: { user: { findUnique: (...a: any[]) => findUnique(...a) }, managementAssignment: { findFirst: (...a: any[]) => findFirst(...a) } } }));

import { canManageBuildingExpenses } from "./authz";

beforeEach(() => { findUnique.mockReset(); findFirst.mockReset(); });

describe("canManageBuildingExpenses", () => {
  it("allows company SUPER_ADMIN without an assignment", async () => {
    findUnique.mockResolvedValue({ role: "SUPER_ADMIN" });
    expect(await canManageBuildingExpenses("u1", "b1")).toBe(true);
    expect(findFirst).not.toHaveBeenCalled();
  });
  it("allows a building manager via ManagementAssignment", async () => {
    findUnique.mockResolvedValue({ role: "PROPERTY_ADMIN" });
    findFirst.mockResolvedValue({ id: "ma1" });
    expect(await canManageBuildingExpenses("u2", "b1")).toBe(true);
  });
  it("rejects an unrelated user", async () => {
    findUnique.mockResolvedValue({ role: "PROPERTY_ADMIN" });
    findFirst.mockResolvedValue(null);
    expect(await canManageBuildingExpenses("u3", "b1")).toBe(false);
  });
  it("rejects unknown user", async () => {
    findUnique.mockResolvedValue(null);
    expect(await canManageBuildingExpenses("u4", "b1")).toBe(false);
  });
});
