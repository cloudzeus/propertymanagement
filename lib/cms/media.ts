import "server-only";
import { db } from "@/lib/db";
export async function listMedia(opts?: { type?: string; q?: string }) {
  return db.mediaAsset.findMany({
    where: {
      ...(opts?.type ? { type: opts.type } : {}),
      ...(opts?.q ? { OR: [{ title: { contains: opts.q, mode: "insensitive" } }, { alt: { contains: opts.q, mode: "insensitive" } }, { originalName: { contains: opts.q, mode: "insensitive" } }] } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
}
/** True when a *Url field actually holds a MediaAsset id (MediaPicker stores ids, not URLs). */
function isMediaId(v: unknown): v is string {
  return typeof v === "string" && v !== "" && !v.includes("://") && !v.startsWith("/") && !v.includes(".");
}

function collectIds(node: unknown, out: Set<string>) {
  if (Array.isArray(node)) { node.forEach((n) => collectIds(n, out)); return; }
  if (!node || typeof node !== "object") return;
  for (const [k, v] of Object.entries(node)) {
    if (/Url$/.test(k) && isMediaId(v)) out.add(v);
    else collectIds(v, out);
  }
}

function substituteIds(node: any, urls: Map<string, string>): any {
  if (Array.isArray(node)) return node.map((n) => substituteIds(n, urls));
  if (!node || typeof node !== "object") return node;
  const next: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node)) {
    // Unresolvable id (deleted asset) becomes "" so components fall back instead of a broken <img>.
    next[k] = /Url$/.test(k) && isMediaId(v) ? urls.get(v) ?? "" : substituteIds(v, urls);
  }
  return next;
}

/** Replaces MediaAsset ids inside any `*Url` field (deep) with the asset's CDN URL. */
export async function resolveMediaDeep<T>(values: T[]): Promise<T[]> {
  const ids = new Set<string>();
  values.forEach((v) => collectIds(v, ids));
  if (ids.size === 0) return values;
  const rows = await db.mediaAsset.findMany({ where: { id: { in: [...ids] } }, select: { id: true, url: true } });
  const urls = new Map(rows.map((r) => [r.id, r.url]));
  return values.map((v) => substituteIds(v, urls));
}

export async function getMediaByIds(ids: string[]) {
  if (!ids.length) return [];
  const rows = await db.mediaAsset.findMany({ where: { id: { in: ids } } });
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}
