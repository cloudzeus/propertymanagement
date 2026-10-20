import type { WikiArticleMeta, WikiSurface } from "./types";

/** Minimal YAML-subset frontmatter: `key: value`, `key: [a, b]`, `key: ["a b", "c"]`. */
export function parseFrontmatter(raw: string): { meta: Record<string, string | string[]>; body: string } {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { meta: {}, body: raw };
  const meta: Record<string, string | string[]> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf(":");
    if (i <= 0) continue;
    const key = t.slice(0, i).trim();
    const val = t.slice(i + 1).trim();
    meta[key] = val.startsWith("[") && val.endsWith("]") ? parseList(val.slice(1, -1)) : unquote(val);
  }
  return { meta, body: raw.slice(m[0].length) };
}

function unquote(v: string): string {
  return (v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")) ? v.slice(1, -1) : v;
}

function parseList(inner: string): string[] {
  const out: string[] = [];
  const re = /\s*(?:"([^"]*)"|'([^']*)'|([^,]+))/g;
  let x: RegExpExecArray | null;
  while ((x = re.exec(inner))) {
    const v = (x[1] ?? x[2] ?? x[3] ?? "").trim();
    if (v) out.push(v);
  }
  return out;
}

export function surfaceForRoute(route: string): WikiSurface {
  if (/^\/(super-admin|admin|manager|staff|announcements)(\/|$)/.test(route)) return "company";
  if (/^\/(building|owner|portal)(\/|$)/.test(route)) return "customer";
  if (/^\/marketplace(\/|$)/.test(route)) return "marketplace";
  return "standalone";
}

const list = (v: string | string[] | undefined): string[] => (Array.isArray(v) ? v : v ? [v] : []);

export function toArticleMeta(slug: string, meta: Record<string, string | string[]>): WikiArticleMeta | null {
  const title = typeof meta.title === "string" ? meta.title : "";
  const route = typeof meta.route === "string" ? meta.route : "";
  if (!title || !route) return null;
  const surface = (typeof meta.surface === "string" ? meta.surface : surfaceForRoute(route)) as WikiSurface;
  return {
    slug, title, route,
    roles: list(meta.roles),
    surface,
    area: typeof meta.area === "string" && meta.area ? meta.area : "other",
    summary: typeof meta.summary === "string" ? meta.summary : "",
    prompts: list(meta.prompts),
    related: list(meta.related),
  };
}
