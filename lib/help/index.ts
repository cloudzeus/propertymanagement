import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { parseFrontmatter, toArticleMeta } from "./frontmatter";
import { articleForRoute, searchArticles } from "./match";
import { filterRoleBlocks } from "./roles-filter";
import { groupArticlesByArea, hubHrefForRole, type AreaGroup } from "./hub";
import { roleAllowed } from "./match";
import type { WikiArticleMeta } from "./types";

export type WikiArticle = WikiArticleMeta & { body: string };

export const PAGES_DIR = path.join(process.cwd(), "docs", "wiki", "pages");

let cache: { articles: WikiArticle[]; stamp: string } | null = null;

/** All per-page articles (docs/wiki/pages/*.md). Cached by directory mtime in production; re-read in dev. */
export async function loadWikiIndex(): Promise<WikiArticle[]> {
  let names: string[];
  try { names = (await fs.readdir(PAGES_DIR)).filter((n) => n.endsWith(".md")).sort(); } catch { return []; }
  const stamp = process.env.NODE_ENV === "production"
    ? String((await fs.stat(PAGES_DIR)).mtimeMs) + ":" + names.length
    : String(Date.now());
  if (cache && cache.stamp === stamp) return cache.articles;
  const articles: WikiArticle[] = [];
  for (const n of names) {
    const raw = await fs.readFile(path.join(PAGES_DIR, n), "utf8");
    const { meta, body } = parseFrontmatter(raw);
    const m = toArticleMeta(n.replace(/\.md$/, ""), meta);
    if (m) articles.push({ ...m, body });
  }
  cache = { articles, stamp };
  return articles;
}

export async function getArticle(slug: string, role: string): Promise<{ meta: WikiArticleMeta; markdown: string } | null> {
  const a = (await loadWikiIndex()).find((x) => x.slug === slug);
  if (!a || !roleAllowed(a.roles, role)) return null;
  const { body, ...meta } = a;
  return { meta, markdown: filterRoleBlocks(body, role) };
}

export async function findArticleForPath(pathname: string, role: string): Promise<WikiArticleMeta | null> {
  return articleForRoute(await loadWikiIndex(), pathname, role);
}

export async function listArticlesForRole(role: string): Promise<AreaGroup[]> {
  return groupArticlesByArea(await loadWikiIndex(), role);
}

export async function searchWikiArticles(q: string, role: string): Promise<WikiArticleMeta[]> {
  return searchArticles(await loadWikiIndex(), q, role);
}

export { hubHrefForRole };
