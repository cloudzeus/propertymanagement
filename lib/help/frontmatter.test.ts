import { describe, it, expect } from "vitest";
import { parseFrontmatter, toArticleMeta } from "./frontmatter";

const RAW = `---
title: Βλάβες & συντηρήσεις
route: /admin/maintenance
roles: [SUPER_ADMIN, ADMIN]
prompts: ["Ποιες βλάβες είναι ανοιχτές;", "Δήλωσε βλάβη στο Α"]
summary: Μία πρόταση.
# comment line

area: operations
---
## Τι βλέπετε εδώ
Κείμενο.
`;

describe("parseFrontmatter", () => {
  it("parses scalar, bare-list and quoted-list values", () => {
    const { meta } = parseFrontmatter(RAW);
    expect(meta.title).toBe("Βλάβες & συντηρήσεις");
    expect(meta.roles).toEqual(["SUPER_ADMIN", "ADMIN"]);
    expect(meta.prompts).toEqual(["Ποιες βλάβες είναι ανοιχτές;", "Δήλωσε βλάβη στο Α"]);
    expect(meta.area).toBe("operations");
  });
  it("returns the body without the fence", () => {
    const { body } = parseFrontmatter(RAW);
    expect(body.startsWith("## Τι βλέπετε εδώ")).toBe(true);
    expect(body).not.toContain("---");
  });
  it("treats a file without frontmatter as pure body", () => {
    const r = parseFrontmatter("# Hello\n");
    expect(r.meta).toEqual({});
    expect(r.body).toBe("# Hello\n");
  });
});

describe("toArticleMeta", () => {
  it("returns null without a title or route", () => {
    expect(toArticleMeta("x", { route: "/a" })).toBeNull();
    expect(toArticleMeta("x", { title: "A" })).toBeNull();
  });
  it("derives the surface from the route and fills defaults", () => {
    const m = toArticleMeta("portal-payments", { title: "Λογαριασμοί", route: "/portal/payments" });
    expect(m).not.toBeNull();
    expect(m!.surface).toBe("customer");
    expect(m!.roles).toEqual([]);
    expect(m!.prompts).toEqual([]);
    expect(m!.related).toEqual([]);
    expect(m!.area).toBe("other");
    expect(m!.slug).toBe("portal-payments");
  });
  it("maps route prefixes to surfaces", () => {
    expect(toArticleMeta("a", { title: "t", route: "/super-admin/users" })!.surface).toBe("company");
    expect(toArticleMeta("a", { title: "t", route: "/marketplace/rfq" })!.surface).toBe("marketplace");
    expect(toArticleMeta("a", { title: "t", route: "/report" })!.surface).toBe("standalone");
  });
});
