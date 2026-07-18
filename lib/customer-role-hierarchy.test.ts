import { describe, it, expect } from "vitest";
import { CUSTOMER_ROLE_RANK, isCustomerRole, roleAfterGaining } from "./customer-role-hierarchy";

describe("customer role hierarchy", () => {
  it("ranks exactly the four customer roles", () => {
    expect(Object.keys(CUSTOMER_ROLE_RANK).sort()).toEqual(
      ["PROPERTY_ADMIN", "PROPERTY_OWNER", "PROPERTY_RESIDENT", "PROPERTY_VIEWER"].sort(),
    );
    expect(CUSTOMER_ROLE_RANK.PROPERTY_ADMIN).toBeGreaterThan(CUSTOMER_ROLE_RANK.PROPERTY_OWNER);
    expect(CUSTOMER_ROLE_RANK.PROPERTY_OWNER).toBeGreaterThan(CUSTOMER_ROLE_RANK.PROPERTY_RESIDENT);
    expect(CUSTOMER_ROLE_RANK.PROPERTY_RESIDENT).toBeGreaterThan(CUSTOMER_ROLE_RANK.PROPERTY_VIEWER);
  });

  it("isCustomerRole: customer roles in, staff/collaborator out", () => {
    expect(isCustomerRole("PROPERTY_ADMIN")).toBe(true);
    expect(isCustomerRole("PROPERTY_OWNER")).toBe(true);
    expect(isCustomerRole("PROPERTY_RESIDENT")).toBe(true);
    expect(isCustomerRole("PROPERTY_VIEWER")).toBe(true);
    expect(isCustomerRole("SUPER_ADMIN")).toBe(false);
    expect(isCustomerRole("ADMIN")).toBe(false);
    expect(isCustomerRole("MANAGER")).toBe(false);
    expect(isCustomerRole("EMPLOYEE")).toBe(false);
    expect(isCustomerRole("COLLABORATOR")).toBe(false);
  });

  describe("roleAfterGaining", () => {
    it("resident gaining OWNER upgrades to PROPERTY_OWNER", () => {
      expect(roleAfterGaining("PROPERTY_RESIDENT", "PROPERTY_OWNER")).toBe("PROPERTY_OWNER");
    });
    it("owner gaining RESIDENT stays PROPERTY_OWNER (never downgrades)", () => {
      expect(roleAfterGaining("PROPERTY_OWNER", "PROPERTY_RESIDENT")).toBe("PROPERTY_OWNER");
    });
    it("viewer gaining RESIDENT upgrades to PROPERTY_RESIDENT", () => {
      expect(roleAfterGaining("PROPERTY_VIEWER", "PROPERTY_RESIDENT")).toBe("PROPERTY_RESIDENT");
    });
    it("staff ADMIN gaining OWNER stays ADMIN (staff roles never touched)", () => {
      expect(roleAfterGaining("ADMIN", "PROPERTY_OWNER")).toBe("ADMIN");
    });
    it("resident gaining PROPERTY_ADMIN upgrades to PROPERTY_ADMIN", () => {
      expect(roleAfterGaining("PROPERTY_RESIDENT", "PROPERTY_ADMIN")).toBe("PROPERTY_ADMIN");
    });
    it("COLLABORATOR gaining OWNER stays COLLABORATOR (outside hierarchy)", () => {
      expect(roleAfterGaining("COLLABORATOR", "PROPERTY_OWNER")).toBe("COLLABORATOR");
    });
    it("gaining the same role is a no-op", () => {
      expect(roleAfterGaining("PROPERTY_OWNER", "PROPERTY_OWNER")).toBe("PROPERTY_OWNER");
    });
    it("candidate outside hierarchy never changes a customer role", () => {
      expect(roleAfterGaining("PROPERTY_RESIDENT", "MANAGER")).toBe("PROPERTY_RESIDENT");
    });
  });
});
