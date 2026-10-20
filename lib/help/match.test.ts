import { describe, it, expect } from "vitest";
import { matchRoute, articleForRoute, openHref, searchArticles } from "./match";
import { slugForRoute } from "./slug";
import type { WikiArticleMeta } from "./types";

const art = (route: string, roles: string[] = [], extra: Partial<WikiArticleMeta> = {}): WikiArticleMeta => ({
  slug: slugForRoute(route), title: route, route, roles, surface: "company", area: "other", summary: "", prompts: [], related: [], ...extra,
});

describe("matchRoute", () => {
  it("matches a dynamic segment exactly once", () => {
    expect(matchRoute("/building/[id]", "/building/abc")).toBe(true);
    expect(matchRoute("/building/[id]", "/building")).toBe(false);
    expect(matchRoute("/building/[id]", "/building/abc/x")).toBe(false);
  });
  it("ignores a trailing slash", () => {
    expect(matchRoute("/portal", "/portal/")).toBe(true);
  });
});

describe("articleForRoute", () => {
  const articles = [art("/admin/maintenance/[id]"), art("/admin/maintenance/settings"), art("/admin/maintenance"), art("/portal", ["PROPERTY_RESIDENT"])];
  it("prefers the most specific pattern", () => {
    expect(articleForRoute(articles, "/admin/maintenance/settings", "ADMIN")!.route).toBe("/admin/maintenance/settings");
    expect(articleForRoute(articles, "/admin/maintenance/abc123", "ADMIN")!.route).toBe("/admin/maintenance/[id]");
  });
  it("excludes articles whose roles do not include the viewer", () => {
    expect(articleForRoute(articles, "/portal", "COLLABORATOR")).toBeNull();
    expect(articleForRoute(articles, "/portal", "PROPERTY_RESIDENT")!.route).toBe("/portal");
  });
  it("returns null when nothing matches", () => {
    expect(articleForRoute(articles, "/nowhere", "ADMIN")).toBeNull();
  });
});

describe("slugForRoute", () => {
  it("maps dynamic segments and roots", () => {
    expect(slugForRoute("/super-admin/buildings/[id]/assemblies/[assemblyId]")).toBe("super-admin-buildings-detail-assemblies-assembly");
    expect(slugForRoute("/super-admin")).toBe("super-admin-home");
    expect(slugForRoute("/admin/work-orders/[id]/contract/[side]")).toBe("admin-work-orders-detail-contract-side");
    expect(slugForRoute("/print")).toBe("print-hub");
    expect(slugForRoute("/super-admin/cms/pages/[slug]")).toBe("super-admin-cms-pages-detail");
  });
});

describe("openHref", () => {
  it("fills a building id when one is known", () => {
    expect(openHref("/building/[id]", "b1")).toBe("/building/b1");
    expect(openHref("/super-admin/buildings/[id]", "b1")).toBe("/super-admin/buildings/b1");
  });
  it("falls back to the parent list path", () => {
    expect(openHref("/admin/maintenance/[id]", null)).toBe("/admin/maintenance");
    expect(openHref("/building/[id]", null)).toBe("/building");
    expect(openHref("/portal/payments", null)).toBe("/portal/payments");
  });
});

describe("searchArticles", () => {
  const articles = [
    art("/portal/payments", [], { title: "Λογαριασμοί κοινοχρήστων", summary: "Τι χρωστάτε και πώς πληρώνετε" }),
    art("/admin/maintenance", ["ADMIN"], { title: "Βλάβες & συντηρήσεις", summary: "Χειρισμός βλαβών" }),
  ];
  it("AND-matches tokens across title and summary, case-insensitively", () => {
    expect(searchArticles(articles, "λογαριασμοί πληρώνετε", "PROPERTY_OWNER").map((a) => a.route)).toEqual(["/portal/payments"]);
    expect(searchArticles(articles, "λογαριασμοί βλάβες", "PROPERTY_OWNER")).toEqual([]);
  });
  it("filters by role", () => {
    expect(searchArticles(articles, "βλάβες", "PROPERTY_OWNER")).toEqual([]);
    expect(searchArticles(articles, "βλάβες", "ADMIN")).toHaveLength(1);
  });
});
