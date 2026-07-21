import { describe, it, expect } from "vitest";
import { RBAC_MODULES, DEFAULT_PERMISSIONS } from "./registry";

describe("managed-buildings module", () => {
  it("is registered on the company surface with a menu entry", () => {
    const m = RBAC_MODULES.find((x) => x.key === "managed-buildings");
    expect(m).toBeTruthy();
    expect(m!.surface).toBe("company");
    expect(m!.menu?.href).toBe("/super-admin/managed-buildings");
  });

  it("is granted (view) to the four company roles including EMPLOYEE", () => {
    for (const role of ["SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE"] as const) {
      expect(DEFAULT_PERMISSIONS[role]).toContain("managed-buildings:view");
    }
  });
});
