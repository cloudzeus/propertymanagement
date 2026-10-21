import { describe, it, expect } from "vitest";
import { customerIdsForScope, viewerFor, workActionViewer } from "./scope";

describe("customerIdsForScope", () => {
  it("restricts a MANAGER with account-managed customers to those customers", () => {
    expect(customerIdsForScope("MANAGER", ["c1", "c2"])).toEqual(["c1", "c2"]);
  });
  it("lets a MANAGER without assignments see everything", () => {
    expect(customerIdsForScope("MANAGER", [])).toBeNull();
  });
  it("never restricts ADMIN / SUPER_ADMIN / EMPLOYEE", () => {
    expect(customerIdsForScope("ADMIN", ["c1"])).toBeNull();
    expect(customerIdsForScope("SUPER_ADMIN", ["c1"])).toBeNull();
    expect(customerIdsForScope("EMPLOYEE", ["c1"])).toBeNull();
  });
});

describe("viewerFor", () => {
  it("EMPLOYEE may manage but not assign, and starts on 'my tasks'", () => {
    expect(viewerFor("EMPLOYEE", "u")).toEqual({ id: "u", role: "EMPLOYEE", canAssign: false, canManage: true, defaultMine: true });
  });
  it("MANAGER / ADMIN / SUPER_ADMIN may assign and start on everything", () => {
    for (const role of ["MANAGER", "ADMIN", "SUPER_ADMIN"]) {
      const v = viewerFor(role, "u");
      expect(v.canAssign).toBe(true);
      expect(v.canManage).toBe(true);
      expect(v.defaultMine).toBe(false);
    }
  });
  it("non-company roles can neither assign nor manage", () => {
    expect(viewerFor("PROPERTY_ADMIN", "u")).toMatchObject({ canAssign: false, canManage: false });
  });
});

describe("workActionViewer", () => {
  it("derives rfq/forward/on-behalf caps from perms", () => {
    const v = workActionViewer("MANAGER", "u", new Set(["rfq:create", "rfq:edit", "suppliers:edit", "maintenance:view"]));
    expect(v).toMatchObject({ canAssign: true, canManage: true, canRfqCreate: true, canRfqEdit: true, canForward: true, canOnBehalf: true, canViewFault: true });
    const e = workActionViewer("EMPLOYEE", "u", new Set(["rfq:create", "suppliers:view", "maintenance:view"]));
    expect(e).toMatchObject({ canAssign: false, canManage: true, canRfqCreate: true, canRfqEdit: false, canForward: false, canOnBehalf: false, canViewFault: true });
  });
  it("gives nothing rfq-related to non-company roles, and no forward without suppliers:edit", () => {
    expect(workActionViewer("PROPERTY_ADMIN", "u", new Set(["rfq:create"])).canRfqCreate).toBe(false);
    expect(workActionViewer("ADMIN", "u", new Set(["rfq:create"])).canForward).toBe(false);
  });
});
