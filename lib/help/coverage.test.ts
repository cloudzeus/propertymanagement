import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { parseFrontmatter, toArticleMeta } from "./frontmatter";

const ROOT = path.resolve(__dirname, "..", "..");
const APP = path.join(ROOT, "app");
const PAGES = path.join(ROOT, "docs", "wiki", "pages");
/** Pages that only redirect (no UI of their own) need no guide. */
const REDIRECT_ONLY = new Set(["/help"]);

/** Every app page route (route groups stripped), excluding public/auth/api/locale pages. */
function appRoutes(): string[] {
  const out: string[] = [];
  const walk = (dir: string, rel: string[]) => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) {
        if (name === "api" || name === "[locale]" || name === "(auth)") continue;
        walk(full, name.startsWith("(") && name.endsWith(")") ? rel : [...rel, name]);
      } else if (name === "page.tsx" && rel.length > 0) {
        const route = "/" + rel.join("/");
        if (!REDIRECT_ONLY.has(route)) out.push(route);
      }
    }
  };
  walk(APP, []);
  return out.sort();
}

function articles() {
  return readdirSync(PAGES).filter((n) => n.endsWith(".md")).map((n) => {
    const { meta } = parseFrontmatter(readFileSync(path.join(PAGES, n), "utf8"));
    return { file: n, meta: toArticleMeta(n.replace(/\.md$/, ""), meta) };
  });
}

describe("wiki coverage", () => {
  const routes = appRoutes();
  const arts = articles();
  const byRoute = new Map(arts.filter((a) => a.meta).map((a) => [a.meta!.route, a]));

  it("every app page has a wiki article with the same route pattern", () => {
    const missing = routes.filter((r) => !byRoute.has(r));
    expect(missing, `Missing articles for: ${missing.join(", ")}`).toEqual([]);
  });
  it("every article has valid frontmatter and points at an existing page", () => {
    const invalid = arts.filter((a) => !a.meta).map((a) => a.file);
    expect(invalid, `Invalid frontmatter: ${invalid.join(", ")}`).toEqual([]);
    const stale = arts.filter((a) => a.meta && !routes.includes(a.meta.route)).map((a) => `${a.file} → ${a.meta!.route}`);
    expect(stale, `Articles for non-existent pages: ${stale.join(", ")}`).toEqual([]);
  });
  it("related slugs resolve to articles (or manual-* keys)", () => {
    const slugs = new Set(arts.map((a) => a.file.replace(/\.md$/, "")));
    const broken = arts.flatMap((a) => (a.meta?.related ?? []).filter((r) => !slugs.has(r) && !r.startsWith("manual-")).map((r) => `${a.file}: ${r}`));
    expect(broken, `Broken related links: ${broken.join(", ")}`).toEqual([]);
  });
  it("the occupant section of the building guide names every occupant tab (mirrors OccupantBuildingShell)", () => {
    const md = readFileSync(path.join(PAGES, "building-detail.md"), "utf8");
    const section = md.split(/^## Ως ιδιοκτήτης ή ένοικος\s*$/m)[1]?.split(/^## /m)[0] ?? "";
    const tabs = ["Επισκόπηση", "Κοινόχρηστα", "Έξοδα", "Μονάδες", "Εγκαταστάσεις", "Συντηρήσεις", "Μετρητές", "Διαχ. στοιχεία", "Συνελεύσεις", "Έγγραφα", "Επαφές", "Ανακοινώσεις"];
    const missing = tabs.filter((t) => !section.includes(`«${t}»`));
    expect(missing, `Occupant tabs missing from building-detail.md: ${missing.join(", ")}`).toEqual([]);
  });
});
