import { describe, it, expect } from "vitest";
import { can, defaultPermissionsFor, buildMenu } from "./permissions";

describe("can()", () => {
  const perms = new Set(["announcements:view", "announcements:create"]);
  it("true when key present", () => expect(can(perms, "announcements", "view")).toBe(true));
  it("false when key absent", () => expect(can(perms, "announcements", "delete")).toBe(false));
  it("false for unknown module", () => expect(can(perms, "nope", "view")).toBe(false));
});

describe("defaultPermissionsFor()", () => {
  it("returns SUPER_ADMIN full set as an array of keys", () => {
    const keys = defaultPermissionsFor("SUPER_ADMIN");
    expect(keys).toContain("announcements:delete");
    expect(keys.every((k) => k.includes(":"))).toBe(true);
  });
  it("PROPERTY_VIEWER cannot create announcements", () => {
    expect(defaultPermissionsFor("PROPERTY_VIEWER")).not.toContain("announcements:create");
  });
});

describe("buildMenu()", () => {
  it("includes only company modules the perms allow to view, grouped", () => {
    const perms = new Set(["dashboard:view", "customers:view"]);
    const menu = buildMenu("company", perms);
    const hrefs = menu.flatMap((g) => g.items.map((i) => i.href));
    expect(hrefs).toContain("/super-admin");
    expect(hrefs).toContain("/super-admin/customers");
    expect(hrefs).not.toContain("/super-admin/users");
  });
  it("excludes modules from other surfaces", () => {
    const perms = new Set(["dashboard:view", "customer-dashboard:view"]);
    const menu = buildMenu("company", perms);
    const hrefs = menu.flatMap((g) => g.items.map((i) => i.href));
    expect(hrefs).not.toContain("/building");
  });
});
