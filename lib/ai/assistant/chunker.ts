import { createHash } from "node:crypto";

export type WikiChunkInput = {
  slug: string; title: string; heading: string | null; anchor: string; route: string | null; surface: string | null;
  roles: string[]; content: string; hash: string;
};
type Meta = { slug: string; title: string; route: string | null; surface: string | null; roles: string[] };

export const MAX_CHUNK_CHARS = 1200;

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
export const slugifyHeading = (h: string) => h.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, "").trim().replace(/\s+/g, "-") || "section";

type Segment = { heading: string | null; roles: string[] | null; text: string };

/** Walk the markdown once, tracking the current H2 heading and the open `:::roles` block (blocks may span several sections). */
function segments(md: string): Segment[] {
  const out: Segment[] = [];
  let heading: string | null = null, roles: string[] | null = null;
  let cur: Segment = { heading, roles, text: "" };
  const flush = () => { if (cur.text.trim()) out.push(cur); cur = { heading, roles, text: "" }; };
  for (const line of md.split(/\r?\n/)) {
    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) { heading = h2[1].trim(); flush(); continue; }
    const open = line.match(/^:::roles\s+(.+)$/i);
    if (open && roles === null) { roles = open[1].split(/[\s,]+/).filter(Boolean).map((r) => r.toUpperCase()); flush(); continue; }
    if (roles !== null && /^:::\s*$/.test(line)) { roles = null; flush(); continue; }
    cur.text += line + "\n";
  }
  flush();
  return out;
}

/** Split an article into retrieval chunks: one per H2 (preamble = `intro`), role blocks as their own chunks, long parts by H3 then paragraphs. */
export function chunkMarkdown(md: string, meta: Meta): WikiChunkInput[] {
  const out: WikiChunkInput[] = [];
  const seen = new Map<string, number>();
  const push = (heading: string | null, text: string, roles: string[]) => {
    const body = text.trim();
    if (!body) return;
    const base = heading ? slugifyHeading(heading) : "intro";
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    const anchor = n === 1 ? base : `${base}-${n}`;
    const content = `${meta.title}${heading ? ` › ${heading}` : ""}\n\n${body}`;
    // The hash covers the audience too, so a roles-only change re-syncs the row.
    out.push({ slug: meta.slug, title: meta.title, heading, anchor, route: meta.route, surface: meta.surface, roles, content, hash: sha(content + "\n" + roles.join(",")) });
  };
  for (const seg of segments(md)) {
    // A role block narrows the article's audience: block ∩ article (or the block alone when the article is open to all).
    const roles = seg.roles === null ? meta.roles : meta.roles.length ? seg.roles.filter((r) => meta.roles.includes(r)) : seg.roles;
    if (seg.text.length <= MAX_CHUNK_CHARS) { push(seg.heading, seg.text, roles); continue; }
    for (const part of splitLong(seg.text)) push(seg.heading, part, roles);
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
