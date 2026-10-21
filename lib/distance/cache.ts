import "server-only";
import { db } from "@/lib/db";
import { routeDistance, type LatLng, type RouteResult } from "./router";

/* One routing result per coordinate pair, keyed on 4-decimal integer
 * coordinates (≈ 11 m) so float equality never matters. ROAD rows live
 * forever; ESTIMATE rows expire after 24 h so the provider gets retried.
 */

export const ESTIMATE_TTL_MS = 24 * 60 * 60 * 1000;

export function coordKey(p: LatLng): { lat4: number; lng4: number } {
  return { lat4: Math.round(p.lat * 10_000), lng4: Math.round(p.lng * 10_000) };
}

function pairKey(from: LatLng, to: LatLng) {
  const f = coordKey(from), t = coordKey(to);
  return { fromLat4: f.lat4, fromLng4: f.lng4, toLat4: t.lat4, toLng4: t.lng4 };
}

type Row = { km: number; minutes: number; method: string; provider: string; expiresAt: Date | null };

const toResult = (r: Row): RouteResult => ({
  km: r.km, minutes: r.minutes,
  method: r.method === "ESTIMATE" ? "ESTIMATE" : "ROAD",
  provider: (r.provider === "osrm" || r.provider === "ors" ? r.provider : "haversine"),
});

/** Cached row for the pair or null — never calls a provider (for list pages). */
export async function peekCachedDistance(from: LatLng, to: LatLng): Promise<RouteResult | null> {
  const row = await db.distanceCache.findUnique({ where: { fromLat4_fromLng4_toLat4_toLng4: pairKey(from, to) } });
  return row ? toResult(row) : null;
}

export async function cachedDistance(
  from: LatLng,
  to: LatLng,
  opts: { force?: boolean; route?: typeof routeDistance; now?: () => Date } = {},
): Promise<RouteResult> {
  const now = opts.now ?? (() => new Date());
  const key = pairKey(from, to);
  const row = await db.distanceCache.findUnique({ where: { fromLat4_fromLng4_toLat4_toLng4: key } });
  if (row && !opts.force && (row.expiresAt == null || row.expiresAt > now())) return toResult(row);

  const result = await (opts.route ?? routeDistance)(from, to);
  const expiresAt = result.method === "ESTIMATE" ? new Date(now().getTime() + ESTIMATE_TTL_MS) : null;
  const data = { km: result.km, minutes: result.minutes, method: result.method, provider: result.provider, expiresAt };
  await db.distanceCache.upsert({ where: { fromLat4_fromLng4_toLat4_toLng4: key }, create: { ...key, ...data }, update: data });
  return result;
}
