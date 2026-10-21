import "server-only";
import { db } from "@/lib/db";
import { coordKey } from "./cache";
import type { LatLng } from "./router";

/* The base station is the managing company's own address (first Company
 * row). Its coordinate key is stamped on every building distance so a moved
 * base automatically marks them stale.
 */

export type BaseStation = { lat: number; lng: number; address: string; key: string };

export function baseKey(p: LatLng): string {
  const k = coordKey(p);
  return `${k.lat4},${k.lng4}`;
}

export async function getBaseStation(): Promise<BaseStation | null> {
  const c = await db.company.findFirst({ orderBy: { createdAt: "asc" }, select: { lat: true, lng: true, address: true, city: true, postalCode: true } });
  if (!c || c.lat == null || c.lng == null) return null;
  const address = [c.address, [c.postalCode, c.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return { lat: c.lat, lng: c.lng, address, key: baseKey({ lat: c.lat, lng: c.lng }) };
}
