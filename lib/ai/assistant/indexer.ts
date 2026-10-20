import { promises as fs } from "fs";
import path from "path";
import { Prisma } from "@/lib/prisma/client";
import { db } from "@/lib/db";
import { loadWikiIndex } from "@/lib/help/index";
import { MANUALS, manualsForRole, type ManualKey } from "@/lib/help";
import { USER_ROLES } from "@/lib/roles-constants";
import { chunkMarkdown, planChunkSync, type WikiChunkInput } from "./chunker";
import { embedTexts, toVectorLiteral } from "./embeddings";

export type IndexResult = { articles: number; chunks: number; embedded: number; deleted: number; keywordOnly: boolean };

type Source = { slug: string; title: string; route: string | null; surface: string | null; roles: string[]; body: string };

async function loadSources(): Promise<Source[]> {
  const pages = (await loadWikiIndex()).map((a) => ({ slug: a.slug, title: a.title, route: a.route, surface: a.surface, roles: a.roles, body: a.body }));
  const manuals: Source[] = [];
  for (const key of Object.keys(MANUALS) as ManualKey[]) {
    const file = path.join(process.cwd(), "docs", "wiki", MANUALS[key].file);
    let body: string;
    try { body = await fs.readFile(file, "utf8"); } catch { continue; }
    const roles = USER_ROLES.filter((r) => manualsForRole(r).includes(key));
    manuals.push({ slug: `manual-${key}`, title: MANUALS[key].title, route: null, surface: null, roles: roles.length === USER_ROLES.length ? [] : [...roles], body });
  }
  return [...pages, ...manuals];
}

/** Chunk every wiki source, embed only changed chunks, upsert rows, delete orphans. Idempotent. */
export async function indexWiki(): Promise<IndexResult> {
  const sources = await loadSources();
  let chunks = 0, embedded = 0, deleted = 0, keywordOnly = false;
  const liveSlugs = new Set<string>();

  for (const src of sources) {
    liveSlugs.add(src.slug);
    const next = chunkMarkdown(src.body, src);
    chunks += next.length;
    const existing = await db.wikiChunk.findMany({ where: { slug: src.slug }, select: { anchor: true, hash: true } });
    const plan = planChunkSync(existing, next);
    if (plan.toDelete.length) {
      deleted += (await db.wikiChunk.deleteMany({ where: { slug: src.slug, anchor: { in: plan.toDelete } } })).count;
    }
    if (!plan.toEmbed.length) continue;
    let vectors: number[][] | null = null;
    try {
      vectors = await embedTexts(plan.toEmbed.map((c) => c.content), "RETRIEVAL_DOCUMENT");
    } catch (e) {
      // Provider unavailable (no key, 403, network): keep indexing text so keyword search works; vectors come on the next run.
      if (!keywordOnly) console.warn("[wiki-index] embeddings unavailable, indexing text only:", e instanceof Error ? e.message : e);
    }
    if (!vectors) keywordOnly = true;
    for (let i = 0; i < plan.toEmbed.length; i++) {
      const id = await upsertChunk(plan.toEmbed[i]);
      if (vectors) {
        await db.$executeRaw(Prisma.sql`UPDATE "WikiChunk" SET "embedding" = ${toVectorLiteral(vectors[i])}::vector WHERE "id" = ${id}`);
        embedded++;
      } else {
        // The text changed but could not be embedded: drop the stale vector so vector search never ranks the old meaning.
        await db.$executeRaw(Prisma.sql`UPDATE "WikiChunk" SET "embedding" = NULL WHERE "id" = ${id}`);
      }
    }
  }
  const stale = await db.wikiChunk.findMany({ where: { slug: { notIn: [...liveSlugs] } }, select: { id: true } });
  if (stale.length) deleted += (await db.wikiChunk.deleteMany({ where: { id: { in: stale.map((s) => s.id) } } })).count;
  return { articles: sources.length, chunks, embedded, deleted, keywordOnly };
}

async function upsertChunk(c: WikiChunkInput): Promise<string> {
  const data = { title: c.title, heading: c.heading, route: c.route, surface: c.surface, roles: c.roles, content: c.content, hash: c.hash };
  const row = await db.wikiChunk.upsert({ where: { slug_anchor: { slug: c.slug, anchor: c.anchor } }, create: { slug: c.slug, anchor: c.anchor, ...data }, update: data, select: { id: true } });
  return row.id;
}
