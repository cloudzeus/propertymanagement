import type { WikiArticleMeta } from "./types";

const segs = (p: string) => p.replace(/\/+$/, "").split("/").filter(Boolean);
const isDynamic = (s: string) => s.startsWith("[") && s.endsWith("]");

/** Segment-wise match; `[x]` matches exactly one non-empty segment. */
export function matchRoute(pattern: string, pathname: string): boolean {
  const a = segs(pattern), b = segs(pathname);
  if (a.length !== b.length) return false;
  return a.every((s, i) => isDynamic(s) || s === b[i]);
}

export const roleAllowed = (roles: string[], role: string) => roles.length === 0 || roles.includes(role);

/** Most specific matching article the role may read (static segments, then pattern length). */
export function articleForRoute(articles: WikiArticleMeta[], pathname: string, role: string): WikiArticleMeta | null {
  let best: WikiArticleMeta | null = null, bestScore = -1;
  for (const a of articles) {
    if (a.kind === "guide" || !a.route || !roleAllowed(a.roles, role) || !matchRoute(a.route, pathname)) continue;
    const score = segs(a.route).filter((s) => !isDynamic(s)).length * 1000 + a.route.length;
    if (score > bestScore) { best = a; bestScore = score; }
  }
  return best;
}

/** Concrete href for a route pattern; `[id]` after building(s) takes the known building, else the parent list. */
export function openHref(route: string, firstBuildingId: string | null): string {
  const s = segs(route);
  const i = s.findIndex(isDynamic);
  if (i < 0) return route;
  if (firstBuildingId && s[i] === "[id]" && (s[i - 1] === "building" || s[i - 1] === "buildings")) {
    return "/" + [...s.slice(0, i), firstBuildingId].join("/");
  }
  return "/" + s.slice(0, i).join("/");
}

/** Token AND-match over title + summary + slug, role-filtered, max 20. */
export function searchArticles(articles: WikiArticleMeta[], q: string, role: string): WikiArticleMeta[] {
  const tokens = q.toLowerCase().split(/\s+/).filter((t) => t.length >= 2);
  if (!tokens.length) return [];
  return articles
    .filter((a) => roleAllowed(a.roles, role))
    .filter((a) => { const hay = `${a.title} ${a.summary} ${a.slug}`.toLowerCase(); return tokens.every((t) => hay.includes(t)); })
    .slice(0, 20);
}
