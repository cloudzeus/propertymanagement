import { ROLE_GROUP } from "@/lib/roles-constants";
import { AREA_LABELS, AREA_ORDER, type WikiArticleMeta } from "./types";
import { roleAllowed } from "./match";

/** The help hub page of a role's surface. */
export function hubHrefForRole(role: string): string {
  const g = ROLE_GROUP[role] ?? "company";
  if (g === "customer") return "/portal/help";
  if (g === "collaborator") return "/marketplace/help";
  return "/staff/help";
}

export type AreaGroup = { area: string; label: string; articles: WikiArticleMeta[] };

/** Role-visible articles grouped by area in AREA_ORDER (unknown areas last), titles sorted el-GR. */
export function groupArticlesByArea(articles: WikiArticleMeta[], role: string): AreaGroup[] {
  const byArea = new Map<string, WikiArticleMeta[]>();
  for (const a of articles) {
    if (!roleAllowed(a.roles, role)) continue;
    byArea.set(a.area, [...(byArea.get(a.area) ?? []), a]);
  }
  const order = [...AREA_ORDER, ...[...byArea.keys()].filter((k) => !AREA_ORDER.includes(k))];
  return order
    .filter((area) => byArea.has(area))
    .map((area) => ({ area, label: AREA_LABELS[area] ?? area, articles: byArea.get(area)!.sort((x, y) => x.title.localeCompare(y.title, "el")) }));
}

/** Related slugs → `{ slug, title }` in the article's order, skipping unknown slugs and articles the role may not read. */
export function relatedArticles(articles: WikiArticleMeta[], slugs: string[], role: string): { slug: string; title: string }[] {
  const out: { slug: string; title: string }[] = [];
  for (const slug of slugs) {
    const a = articles.find((x) => x.slug === slug);
    if (a && roleAllowed(a.roles, role)) out.push({ slug: a.slug, title: a.title });
  }
  return out;
}
