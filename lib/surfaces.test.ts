import { describe, it, expect } from "vitest";
import { surfaceForRole, homePathForRole, SURFACE_ROLES } from "./surfaces";

describe("surfaceForRole", () => {
  it("maps company roles", () => {
    expect(surfaceForRole("SUPER_ADMIN")).toBe("company");
    expect(surfaceForRole("EMPLOYEE")).toBe("company");
  });
  it("maps customer roles", () => {
    expect(surfaceForRole("PROPERTY_OWNER")).toBe("customer");
    expect(surfaceForRole("PROPERTY_RESIDENT")).toBe("customer");
  });
  it("maps collaborator to marketplace", () => {
    expect(surfaceForRole("COLLABORATOR")).toBe("marketplace");
  });
});

describe("homePathForRole", () => {
  it("returns the role landing path", () => {
    expect(homePathForRole("SUPER_ADMIN")).toBe("/super-admin");
    expect(homePathForRole("ADMIN")).toBe("/admin");
    expect(homePathForRole("MANAGER")).toBe("/manager");
    expect(homePathForRole("PROPERTY_ADMIN")).toBe("/portal");
    expect(homePathForRole("EMPLOYEE")).toBe("/staff");
    expect(homePathForRole("COLLABORATOR")).toBe("/marketplace");
    expect(homePathForRole("PROPERTY_OWNER")).toBe("/owner");
    expect(homePathForRole("PROPERTY_RESIDENT")).toBe("/portal");
    expect(homePathForRole("PROPERTY_VIEWER")).toBe("/portal");
  });
});

describe("SURFACE_ROLES", () => {
  it("lists company roles", () => {
    expect(SURFACE_ROLES.company).toContain("SUPER_ADMIN");
    expect(SURFACE_ROLES.marketplace).toEqual(["COLLABORATOR"]);
  });
});
