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
export async function getMediaByIds(ids: string[]) {
  if (!ids.length) return [];
  const rows = await db.mediaAsset.findMany({ where: { id: { in: ids } } });
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}
