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
  it("reads the optional sections list (tab key → heading) used for help anchors", () => {
    const { meta } = parseFrontmatter(`---\ntitle: t\nroute: /building/[id]\nsections: ["koino: Κοινόχρηστα", "finance: Οικονομικά"]\n---\nbody`);
    expect(toArticleMeta("a", meta)!.sections).toEqual(["koino: Κοινόχρηστα", "finance: Οικονομικά"]);
    expect(toArticleMeta("a", { title: "t", route: "/x" })!.sections).toEqual([]);
  });
});

describe("guide articles", () => {
  it("need no route and carry kind/wizard/video/minutes, always in the guides area", () => {
    const m = toArticleMeta("guide-x", { title: "Τ", kind: "guide", wizard: "customer-new", video: "https://cdn/x.mp4", videoPoster: "https://cdn/x.jpg", minutes: "2", area: "management" })!;
    expect(m.kind).toBe("guide");
    expect(m.route).toBe("");
    expect(m.wizard).toBe("customer-new");
    expect(m.video).toBe("https://cdn/x.mp4");
    expect(m.videoPoster).toBe("https://cdn/x.jpg");
    expect(m.minutes).toBe(2);
    expect(m.area).toBe("guides");
    expect(m.surface).toBe("company");
  });
  it("page articles default to kind page without video fields", () => {
    const m = toArticleMeta("a", { title: "T", route: "/x" })!;
    expect(m.kind).toBe("page");
    expect(m.video).toBeUndefined();
    expect(m.minutes).toBeUndefined();
  });
  it("a guide still needs a title", () => {
    expect(toArticleMeta("g", { kind: "guide", wizard: "x" })).toBeNull();
  });
});
