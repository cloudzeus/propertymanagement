import { describe, it, expect } from "vitest";
import { WIZARDS, allowedWizards, getWizard, isWizardKey, nextWizard, wizardHref } from "./registry";

describe("wizard registry", () => {
  it("has 12 unique keys, each with guideSlug and videoKey", () => {
    expect(new Set(WIZARDS.map((w) => w.key)).size).toBe(12);
    expect(WIZARDS.length).toBe(12);
    for (const w of WIZARDS) {
      expect(w.guideSlug, w.key).toMatch(/^guide-/);
      expect(w.videoKey, w.key).toMatch(/^[A-Z][A-Za-z]+$/);
      expect(w.icon, w.key).toMatch(/^Ri[A-Za-z0-9]+Line$/);
    }
  });

  it("building-scope wizards carry a cap, the others a permission", () => {
    for (const w of WIZARDS) {
      if (w.scope === "building") { expect(w.cap, w.key).toBeTruthy(); expect(w.permission, w.key).toBeUndefined(); }
      else { expect(w.permission, w.key).toBeTruthy(); expect(w.cap, w.key).toBeUndefined(); }
    }
  });

  it("chain customer→property→building→millesimes→package", () => {
    expect(nextWizard("customer-new")?.key).toBe("property-new");
    expect(nextWizard("property-new")?.key).toBe("building-new");
    expect(nextWizard("building-new")?.key).toBe("millesimes-setup");
    expect(nextWizard("millesimes-setup")?.key).toBe("package-setup");
    expect(nextWizard("common-area-new")?.key).toBe("package-setup");
    expect(nextWizard("supplier-new")).toBeNull();
    expect(nextWizard("package-setup")).toBeNull();
  });

  it("wizardHref appends only the given ctx ids", () => {
    expect(wizardHref("/super-admin/customers", "property-new", { customerId: "c1" })).toBe("/super-admin/customers?wizard=property-new&customerId=c1");
    expect(wizardHref("/x", "service-new")).toBe("/x?wizard=service-new");
    expect(wizardHref("/x", "millesimes-setup", { buildingId: "b 1" })).toBe("/x?wizard=millesimes-setup&buildingId=b%201");
  });

  it("isWizardKey rejects unknown and non-strings", () => {
    expect(isWizardKey("service-new")).toBe(true);
    expect(isWizardKey("nope")).toBe(false);
    expect(isWizardKey(null)).toBe(false);
    expect(isWizardKey(42)).toBe(false);
  });

  it("getWizard returns the definition", () => {
    expect(getWizard("customer-new").title).toContain("πελάτης");
    expect(getWizard("millesimes-setup").cap).toBe("editMillesimes");
  });

  it("allowedWizards honours perms and superAdminOnly, excludes building scope", () => {
    const perms = new Set(["customers:create", "services:create", "suppliers:create", "properties:edit"]);
    expect(allowedWizards(perms, "ADMIN")).toEqual(["package-setup", "supplier-new"]);
    const sa = allowedWizards(perms, "SUPER_ADMIN");
    expect(sa).toEqual(expect.arrayContaining(["customer-new", "service-new", "supplier-new", "package-setup"]));
    expect(sa).not.toContain("property-new"); // needs properties:create
    expect(sa).not.toContain("millesimes-setup");
    expect(allowedWizards(new Set(), "SUPER_ADMIN")).toEqual([]);
  });
});
