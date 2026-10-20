import { createHash } from "node:crypto";

export type WikiChunkInput = {
  slug: string; title: string; heading: string | null; anchor: string; route: string | null; surface: string | null;
  roles: string[]; content: string; hash: string;
};
type Meta = { slug: string; title: string; route: string | null; surface: string | null; roles: string[] };

export const MAX_CHUNK_CHARS = 1200;

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
export const slugifyHeading = (h: string) => h.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, "").trim().replace(/\s+/g, "-") || "section";
const stripFences = (s: string) => s.replace(/^:::roles[^\n]*\n?/gim, "").replace(/^:::\s*$/gm, "");

/** Split an article into retrieval chunks: one per H2 (preamble = `intro`), long sections by H3 then paragraphs. */
export function chunkMarkdown(md: string, meta: Meta): WikiChunkInput[] {
  const sections: { heading: string | null; text: string }[] = [];
  let cur: { heading: string | null; text: string } = { heading: null, text: "" };
  for (const line of md.split(/\r?\n/)) {
    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) { sections.push(cur); cur = { heading: h2[1].trim(), text: "" }; continue; }
    cur.text += line + "\n";
  }
  sections.push(cur);

  const out: WikiChunkInput[] = [];
  const seen = new Map<string, number>();
  const push = (heading: string | null, text: string) => {
    const body = stripFences(text).trim();
    if (!body) return;
    const base = heading ? slugifyHeading(heading) : "intro";
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    const anchor = n === 1 ? base : `${base}-${n}`;
    const content = `${meta.title}${heading ? ` › ${heading}` : ""}\n\n${body}`;
    out.push({ slug: meta.slug, title: meta.title, heading, anchor, route: meta.route, surface: meta.surface, roles: meta.roles, content, hash: sha(content) });
  };
  for (const s of sections) {
    if (s.text.length <= MAX_CHUNK_CHARS) { push(s.heading, s.text); continue; }
    for (const part of splitLong(s.text)) push(s.heading, part);
  }
  return out;
}

function splitLong(text: string): string[] {
  const byH3 = text.split(/^(?=###\s)/m);
  const pieces: string[] = [];
  for (const p of byH3) {
    if (p.length <= MAX_CHUNK_CHARS) { if (p.trim()) pieces.push(p); continue; }
    let acc = "";
    for (const para of p.split(/\n{2,}/)) {
      const candidate = acc ? acc + "\n\n" + para : para;
      if (candidate.length > MAX_CHUNK_CHARS && acc) { pieces.push(acc); acc = para; } else acc = candidate;
      while (acc.length > MAX_CHUNK_CHARS) { pieces.push(acc.slice(0, MAX_CHUNK_CHARS)); acc = acc.slice(MAX_CHUNK_CHARS); }
    }
    if (acc.trim()) pieces.push(acc);
  }
  return pieces;
}

export function planChunkSync(existing: { anchor: string; hash: string }[], next: WikiChunkInput[]): { toEmbed: WikiChunkInput[]; unchanged: string[]; toDelete: string[] } {
  const have = new Map(existing.map((e) => [e.anchor, e.hash]));
  const nextAnchors = new Set(next.map((c) => c.anchor));
  return {
    toEmbed: next.filter((c) => have.get(c.anchor) !== c.hash),
    unchanged: next.filter((c) => have.get(c.anchor) === c.hash).map((c) => c.anchor),
    toDelete: existing.filter((e) => !nextAnchors.has(e.anchor)).map((e) => e.anchor),
  };
}
