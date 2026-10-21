import "server-only";
import { db } from "@/lib/db";
import { getBaseStation } from "./base";
import { cachedDistance } from "./cache";
import { parseZones, zoneForKm, type DistanceMethod, type DistanceZone } from "./zones";

/* Building ↔ base-station distances. The measured km/minutes live on the
 * Building row together with the base key they were measured from; a row is
 * stale when it was never measured, the base moved, or the value is only an
 * estimate (retried nightly by the base-distances cron).
 */

export type BuildingDistance = {
  distanceKm: number | null;
  distanceMinutes: number | null;
  distanceMethod: DistanceMethod | null;
  distanceAt: Date | null;
  distanceBaseKey: string | null;
};

const EMPTY: BuildingDistance = { distanceKm: null, distanceMinutes: null, distanceMethod: null, distanceAt: null, distanceBaseKey: null };

export function isStale(b: { distanceAt: Date | null; distanceBaseKey: string | null; distanceMethod: string | null }, baseKey: string): boolean {
  return b.distanceAt == null || b.distanceBaseKey !== baseKey || b.distanceMethod === "ESTIMATE";
}

/** The company's zone table (AppSettings.distanceZones, defaults when unset). */
export async function getDistanceZones(): Promise<DistanceZone[]> {
  const s = await db.appSettings.findUnique({ where: { id: "singleton" }, select: { distanceZones: true } });
  return parseZones(s?.distanceZones ?? null);
}

export function buildingZone(zones: DistanceZone[], b: { distanceKm: number | null }): DistanceZone | null {
  return zoneForKm(zones, b.distanceKm);
}

/** Measure one building from the base and persist the result (nulls when either side has no coordinates). */
export async function recomputeBuildingDistance(buildingId: string, opts: { force?: boolean } = {}): Promise<BuildingDistance> {
  const [base, b] = await Promise.all([
    getBaseStation(),
    db.building.findUnique({ where: { id: buildingId }, select: { id: true, lat: true, lng: true } }),
  ]);
  if (!b) throw new Error("Building not found");
  let next: BuildingDistance = EMPTY;
  if (base && b.lat != null && b.lng != null) {
    const r = await cachedDistance({ lat: base.lat, lng: base.lng }, { lat: b.lat, lng: b.lng }, { force: !!opts.force });
    next = { distanceKm: r.km, distanceMinutes: r.minutes, distanceMethod: r.method, distanceAt: new Date(), distanceBaseKey: base.key };
  }
  await db.building.update({ where: { id: buildingId }, data: next });
  return next;
}

/** Hook for building writes: best effort, never throws (the write already happened). */
export async function touchBuildingDistance(buildingId: string): Promise<void> {
  try {
    await recomputeBuildingDistance(buildingId);
  } catch (e) {
    console.error("[distance] recompute failed for building", buildingId, e);
  }
}

/** Cron / «Επανυπολογισμός όλων»: stale (or all, with force) buildings, sequentially, up to `limit`. */
export async function recomputeStaleBuildings(opts: { limit?: number; force?: boolean } = {}): Promise<{ scanned: number; updated: number; estimated: number; skipped: number }> {
  const limit = opts.limit ?? 300;
  const [base, rows] = await Promise.all([
    getBaseStation(),
    db.building.findMany({ select: { id: true, lat: true, lng: true, distanceAt: true, distanceBaseKey: true, distanceMethod: true } }),
  ]);
  const out = { scanned: rows.length, updated: 0, estimated: 0, skipped: 0 };
  if (!base) { out.skipped = rows.length; return out; }
  const todo = rows.filter((b) => b.lat != null && b.lng != null && (opts.force || isStale(b, base.key)));
  const batch = todo.slice(0, limit);
  for (const b of batch) {
    const r = await recomputeBuildingDistance(b.id, { force: opts.force });
    out.updated++;
    if (r.distanceMethod === "ESTIMATE") out.estimated++;
  }
  out.skipped = rows.length - batch.length;
  return out;
}
