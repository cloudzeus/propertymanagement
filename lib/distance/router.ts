import "server-only";
import { haversineKm } from "@/lib/supplier-ranking";
import { providerThrottle, type Throttle } from "./throttle";
import type { DistanceMethod } from "./zones";

/* Road distance between two points from a free routing API.
 *
 * Provider order: OpenRouteService when ORS_API_KEY is set (2 000 calls/day on
 * the free tier), otherwise the public OSRM demo server (no key, ≤ 1 req/s,
 * identified User-Agent). Every failure degrades to a haversine estimate
 * (straight line × 1.3, 50 km/h) flagged ESTIMATE so callers can retry later.
 * Server-only: never call providers from the browser.
 */

export type LatLng = { lat: number; lng: number };
export type RouteProvider = "osrm" | "ors" | "haversine";
export type RouteResult = { km: number; minutes: number; method: DistanceMethod; provider: RouteProvider };
export type RouterDeps = {
  fetch?: typeof fetch;
  env?: { ORS_API_KEY?: string; NEXT_PUBLIC_SITE_URL?: string };
  throttle?: Throttle;
  timeoutMs?: number;
};

const ROAD_FACTOR = 1.3;
const AVG_KMH = 50;
const OSRM_URL = "https://router.project-osrm.org/route/v1/driving";
const ORS_URL = "https://api.openrouteservice.org/v2/directions/driving-car";

const roundKm = (meters: number) => Math.round(meters / 100) / 10;
const roundMin = (seconds: number) => Math.round(seconds / 60);

export function estimateRoute(from: LatLng, to: LatLng): RouteResult {
  const km = Math.round(haversineKm(from.lat, from.lng, to.lat, to.lng) * ROAD_FACTOR * 10) / 10;
  return { km, minutes: Math.round((km / AVG_KMH) * 60), method: "ESTIMATE", provider: "haversine" };
}

function userAgent(siteUrl: string | undefined): string {
  return `Orithon-PropertyManagement/1.0${siteUrl ? ` (+${siteUrl})` : ""}`;
}

async function fetchJson(doFetch: typeof fetch, url: string, init: RequestInit, timeoutMs: number): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await doFetch(url, { ...init, signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function viaOsrm(from: LatLng, to: LatLng, doFetch: typeof fetch, ua: string, timeoutMs: number): Promise<RouteResult> {
  const url = `${OSRM_URL}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`;
  const data = (await fetchJson(doFetch, url, { method: "GET", headers: { "User-Agent": ua, Accept: "application/json" } }, timeoutMs)) as
    { code?: string; routes?: { distance?: number; duration?: number }[] };
  const r = data?.code === "Ok" ? data.routes?.[0] : undefined;
  if (!r || typeof r.distance !== "number" || typeof r.duration !== "number") throw new Error("OSRM: no route");
  return { km: roundKm(r.distance), minutes: roundMin(r.duration), method: "ROAD", provider: "osrm" };
}

async function viaOrs(from: LatLng, to: LatLng, key: string, doFetch: typeof fetch, ua: string, timeoutMs: number): Promise<RouteResult> {
  const data = (await fetchJson(doFetch, ORS_URL, {
    method: "POST",
    headers: { "User-Agent": ua, Accept: "application/json", "Content-Type": "application/json", Authorization: key },
    body: JSON.stringify({ coordinates: [[from.lng, from.lat], [to.lng, to.lat]] }),
  }, timeoutMs)) as { routes?: { summary?: { distance?: number; duration?: number } }[] };
  const s = data?.routes?.[0]?.summary;
  if (!s || typeof s.distance !== "number" || typeof s.duration !== "number") throw new Error("ORS: no route");
  return { km: roundKm(s.distance), minutes: roundMin(s.duration), method: "ROAD", provider: "ors" };
}

/** Road km/minutes between two points; never throws (falls back to an estimate). */
export async function routeDistance(from: LatLng, to: LatLng, deps: RouterDeps = {}): Promise<RouteResult> {
  const env = deps.env ?? { ORS_API_KEY: process.env.ORS_API_KEY, NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL };
  const doFetch = deps.fetch ?? fetch;
  const throttle = deps.throttle ?? providerThrottle;
  const timeoutMs = deps.timeoutMs ?? 8000;
  const ua = userAgent(env.NEXT_PUBLIC_SITE_URL);
  try {
    return await throttle(() => (env.ORS_API_KEY ? viaOrs(from, to, env.ORS_API_KEY, doFetch, ua, timeoutMs) : viaOsrm(from, to, doFetch, ua, timeoutMs)));
  } catch {
    return estimateRoute(from, to);
  }
}
