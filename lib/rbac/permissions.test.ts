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

describe("buildMenu() — company groups", () => {
  it("orders company groups overview → customers → operations → … → help and collapses settings/softone/cms", () => {
    const perms = new Set(["help:view", "settings:view", "cms-landing:view", "maintenance:view", "customers:view", "dashboard:view", "billing:view", "softone-sync:view", "announcements:view", "suppliers:view"]);
    const menu = buildMenu("company", perms, "ADMIN");
    expect(menu.map((g) => g.id)).toEqual(["overview", "customers", "operations", "suppliers", "communication", "financials", "settings", "softone", "cms", "help"]);
    expect(menu.find((g) => g.id === "settings")!.defaultOpen).toBe(false);
    expect(menu.find((g) => g.id === "cms")!.defaultOpen).toBe(false);
    expect(menu.find((g) => g.id === "operations")!.defaultOpen).toBe(true);
    expect(menu.find((g) => g.id === "customers")!.label).toBe("Πελάτες & Ακίνητα");
  });
  it("points the company Dashboard at each role's home", () => {
    const perms = new Set(["dashboard:view"]);
    expect(buildMenu("company", perms, "ADMIN")[0].items[0].href).toBe("/admin");
    expect(buildMenu("company", perms, "MANAGER")[0].items[0].href).toBe("/manager");
    expect(buildMenu("company", perms, "EMPLOYEE")[0].items[0].href).toBe("/staff");
    expect(buildMenu("company", perms, "SUPER_ADMIN")[0].items[0].label).toBe("Αρχική");
  });
  it("puts the work center in overview right after the home", () => {
    const items = buildMenu("company", new Set(["dashboard:view", "work:view", "reports:view"]), "ADMIN")[0].items.map((i) => i.href);
    expect(items).toEqual(["/admin", "/admin/work", "/super-admin/reports"]);
  });
  it("every group carries label/icon/color/defaultOpen on every surface", () => {
    const menu = buildMenu("customer", new Set(["customer-dashboard:view", "customer-units:view"]), "PROPERTY_OWNER");
    expect(menu[0].id).toBe("core");
    for (const g of menu) { expect(typeof g.label).toBe("string"); expect(typeof g.icon).toBe("string"); expect(typeof g.defaultOpen).toBe("boolean"); }
  });
});
