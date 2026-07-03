import { describe, it, expect } from "vitest";
import { surfaceForRole, homePathForRole, SURFACE_ROLES, deniedRedirectPath } from "./surfaces";

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
    expect(homePathForRole("PROPERTY_ADMIN")).toBe("/building");
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

describe("deniedRedirectPath", () => {
  it("sends a normal (non-impersonating) blocked user to /unauthorized", () => {
    // real === effective → not impersonating
    expect(deniedRedirectPath("PROPERTY_OWNER", "PROPERTY_OWNER", "/admin")).toBe("/unauthorized");
  });
  it("sends an impersonating super-admin to the impersonated role's home (escape hatch)", () => {
    // super-admin impersonating PROPERTY_ADMIN, blocked on /super-admin → go to /building where the Exit banner lives
    expect(deniedRedirectPath("SUPER_ADMIN", "PROPERTY_ADMIN", "/super-admin")).toBe("/building");
  });
  it("falls back to /unauthorized if the impersonated home is the path already being blocked (no loop)", () => {
    expect(deniedRedirectPath("SUPER_ADMIN", "PROPERTY_ADMIN", "/building")).toBe("/unauthorized");
  });
});
