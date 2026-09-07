import "server-only";
import { db } from "@/lib/db";
import { pickLocale } from "@/lib/i18n/translatable";
import type { Locale } from "@/i18n";

export async function getPublishedArticles(opts?: { tag?: string; take?: number; skip?: number }) {
  return db.article.findMany({
    where: { status: "PUBLISHED", ...(opts?.tag ? { tags: { has: opts.tag } } : {}) },
    orderBy: { publishedAt: "desc" },
    take: opts?.take ?? 12, skip: opts?.skip ?? 0,
    include: { author: true },
  });
}
export async function countPublishedArticles(tag?: string) {
  return db.article.count({ where: { status: "PUBLISHED", ...(tag ? { tags: { has: tag } } : {}) } });
}
export async function getArticleBySlug(slug: string) {
  return db.article.findUnique({ where: { slug }, include: { author: true } });
}
export function localizedArticle(row: { i18n: any }, locale: Locale) {
  const i = row.i18n ?? {};
  return { title: i.title ? pickLocale(i.title, locale) : "", excerpt: i.excerpt ? pickLocale(i.excerpt, locale) : "", body: i.body ? pickLocale(i.body, locale) : "" };
}
export async function allPublishedTags(): Promise<string[]> {
  const rows = await db.article.findMany({ where: { status: "PUBLISHED" }, select: { tags: true } });
  return [...new Set(rows.flatMap((r) => r.tags))].sort();
}
export async function listAuthors() { return db.author.findMany({ orderBy: { name: "asc" } }); }
export async function getAuthor(id: string) { return db.author.findUnique({ where: { id } }); }
export async function publishedArticleSlugs() {
  return db.article.findMany({ where: { status: "PUBLISHED" }, select: { slug: true } });
}

/** Articles sharing a tag with `tags`, newest first, excluding `excludeSlug`. */
export async function getRelatedArticles(tags: string[], excludeSlug: string, take = 3) {
  const byTag = tags.length
    ? await db.article.findMany({
        where: { status: "PUBLISHED", slug: { not: excludeSlug }, tags: { hasSome: tags } },
        orderBy: { publishedAt: "desc" },
        take,
        include: { author: true },
      })
    : [];
  if (byTag.length >= take) return byTag;
  // Top up with the newest articles so the band is never half-empty.
  const fill = await db.article.findMany({
    where: {
      status: "PUBLISHED",
      slug: { notIn: [excludeSlug, ...byTag.map((a) => a.slug)] },
    },
    orderBy: { publishedAt: "desc" },
    take: take - byTag.length,
    include: { author: true },
  });
  return [...byTag, ...fill];
}

/** ~200 words per minute, floored at 1. The design shows a read time on every card. */
export function readMinutes(body: string): number {
  const words = body.replace(/<[^>]+>/g, " ").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
