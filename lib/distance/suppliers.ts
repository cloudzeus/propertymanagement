import "server-only";
import { db } from "@/lib/db";
import { cachedDistance } from "./cache";
import { getDistanceZones } from "./buildings";
import { zoneForKm, type DistanceMethod, type DistanceZone } from "./zones";

/* Supplier ↔ building distance for the site-survey surcharge. Measured from the
 * supplier's own address with the company's zone table; the pair lives in the
 * DistanceCache, nothing is stored on the Supplier row.
 */

export type SupplierDistance = { km: number; minutes: number; method: DistanceMethod; zone: DistanceZone | null; zoneFee: number };

const feeOf = (fees: Record<string, unknown> | null | undefined, code: string | null): number => {
  if (!fees || !code) return 0;
  const n = Number(String(fees[code] ?? 0).replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** Pre-filled survey fee: base + the supplier's surcharge for the zone; null when nothing applies. */
export function surveyDefault(base: number | null, fees: Record<string, number> | null | undefined, zoneCode: string | null): number | null {
  const fee = feeOf(fees, zoneCode);
  if (base == null && fee === 0) return null;
  return Math.round(((base ?? 0) + fee) * 100) / 100;
}

export async function supplierToBuilding(supplierId: string, buildingId: string): Promise<SupplierDistance | null> {
  const [s, b] = await Promise.all([
    db.supplier.findUnique({ where: { id: supplierId }, select: { lat: true, lng: true, surveyZoneFees: true } }),
    db.building.findUnique({ where: { id: buildingId }, select: { lat: true, lng: true } }),
  ]);
  if (!s || !b || s.lat == null || s.lng == null || b.lat == null || b.lng == null) return null;
  const [r, zones] = await Promise.all([cachedDistance({ lat: s.lat, lng: s.lng }, { lat: b.lat, lng: b.lng }), getDistanceZones()]);
  const zone = zoneForKm(zones, r.km);
  return { km: r.km, minutes: r.minutes, method: r.method, zone, zoneFee: feeOf(s.surveyZoneFees as Record<string, unknown> | null, zone?.code ?? null) };
}
