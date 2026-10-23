import { describe, it, expect } from "vitest";
import { hubHrefForRole, groupArticlesByArea, relatedArticles } from "./hub";
import type { WikiArticleMeta } from "./types";

const art = (route: string, area: string, title: string, roles: string[] = []): WikiArticleMeta => ({
  slug: route.slice(1).replace(/\//g, "-"), title, route, roles, surface: "company", area, summary: "", prompts: [], related: [], kind: "page",
});

describe("hubHrefForRole", () => {
  it("maps each role group to its surface hub", () => {
    expect(hubHrefForRole("SUPER_ADMIN")).toBe("/staff/help");
    expect(hubHrefForRole("EMPLOYEE")).toBe("/staff/help");
    expect(hubHrefForRole("PROPERTY_OWNER")).toBe("/portal/help");
    expect(hubHrefForRole("PROPERTY_ADMIN")).toBe("/portal/help");
    expect(hubHrefForRole("COLLABORATOR")).toBe("/marketplace/help");
  });
});

describe("groupArticlesByArea", () => {
  const articles = [
    art("/admin/costs", "financials", "Κόστη"),
    art("/admin", "core", "Αρχική"),
    art("/admin/maintenance", "operations", "Βλάβες", ["ADMIN"]),
    art("/admin/announcements", "operations", "Ανακοινώσεις"),
  ];
  it("orders areas by AREA_ORDER with labels and sorts titles, omitting empty areas", () => {
    const g = groupArticlesByArea(articles, "ADMIN");
    expect(g.map((x) => x.area)).toEqual(["core", "operations", "financials"]);
    expect(g[1].label).toBe("Βλάβες, συντηρήσεις, ανακοινώσεις");
    expect(g[1].articles.map((a) => a.title)).toEqual(["Ανακοινώσεις", "Βλάβες"]);
  });
  it("drops articles the role may not read", () => {
    const g = groupArticlesByArea(articles, "EMPLOYEE");
    expect(g.find((x) => x.area === "operations")!.articles.map((a) => a.title)).toEqual(["Ανακοινώσεις"]);
  });
});

describe("relatedArticles", () => {
  const articles = [art("/admin", "core", "Αρχική"), art("/admin/maintenance", "operations", "Βλάβες", ["ADMIN"]), art("/admin/costs", "financials", "Κόστη")];
  it("resolves related slugs to titles in the given order, dropping unknown slugs and articles the role may not read", () => {
    expect(relatedArticles(articles, ["admin-costs", "admin-maintenance", "nope", "admin"], "EMPLOYEE")).toEqual([{ slug: "admin-costs", title: "Κόστη" }, { slug: "admin", title: "Αρχική" }]);
    expect(relatedArticles(articles, ["admin-maintenance"], "ADMIN")).toEqual([{ slug: "admin-maintenance", title: "Βλάβες" }]);
  });
});

describe("guides group", () => {
  const guide = (slug: string): WikiArticleMeta => ({ slug, title: slug, route: "", roles: [], surface: "company", area: "guides", summary: "", prompts: [], related: [], kind: "guide", wizard: "customer-new" });
  it("comes first with its label", () => {
    const g = groupArticlesByArea([art("/admin", "core", "Αρχική"), guide("guide-customer")], "ADMIN");
    expect(g[0].area).toBe("guides");
    expect(g[0].label).toBe("Οδηγοί βήμα-βήμα");
    expect(g[1].area).toBe("core");
  });
});
