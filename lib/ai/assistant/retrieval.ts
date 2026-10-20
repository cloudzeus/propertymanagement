import { Prisma } from "@/lib/prisma/client";
import { db } from "@/lib/db";
import type { WikiHit } from "@/lib/ai/tools/types";
import { embedTexts, toVectorLiteral } from "./embeddings";

let warnedFallback = false;

/** Top wiki chunks for a question, role-filtered: pgvector cosine when embeddings work, else keyword AND-match. */
export async function retrieveWiki(query: string, role: string, limit = 5, meta: { userId?: string; customerId?: string } = {}): Promise<WikiHit[]> {
  const q = query.trim();
  if (!q) return [];
  try {
    const vectors = await embedTexts([q], "RETRIEVAL_QUERY", meta);
    if (vectors && vectors[0]) {
      const vec = toVectorLiteral(vectors[0]);
      const rows = await db.$queryRaw<WikiHit[]>(Prisma.sql`
        SELECT "slug", "title", "heading", "route", "content", 1 - ("embedding" <=> ${vec}::vector) AS "score"
        FROM "WikiChunk"
        WHERE "embedding" IS NOT NULL AND (cardinality("roles") = 0 OR ${role} = ANY("roles"))
        ORDER BY "embedding" <=> ${vec}::vector
        LIMIT ${limit}`);
      return rows.map((r) => ({ slug: r.slug, title: r.title, heading: r.heading, route: r.route, content: r.content, score: Number(r.score) }));
    }
  } catch (e) {
    if (!warnedFallback) { warnedFallback = true; console.warn("[assistant] vector retrieval unavailable, using keyword fallback:", e instanceof Error ? e.message : e); }
  }
  return keywordSearch(q, role, limit);
}

async function keywordSearch(q: string, role: string, limit: number): Promise<WikiHit[]> {
  const tokens = q.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((t) => t.length >= 3).slice(0, 5);
  if (!tokens.length) return [];
  const rows = await db.wikiChunk.findMany({
    where: { AND: tokens.map((t) => ({ content: { contains: t, mode: "insensitive" as const } })), OR: [{ roles: { isEmpty: true } }, { roles: { has: role } }] },
    select: { slug: true, title: true, heading: true, route: true, content: true },
    take: limit,
  });
  return rows.map((r) => ({ slug: r.slug, title: r.title, heading: r.heading, route: r.route, content: r.content }));
}
