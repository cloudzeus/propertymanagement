import { describe, it, expect, vi } from "vitest";
import { routeDistance, estimateRoute } from "./router";

const A = { lat: 37.98, lng: 23.73 };
const B = { lat: 38.0, lng: 23.8 };
const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as unknown as Response;
const noThrottle = { throttle: <T,>(fn: () => Promise<T>) => fn() };

describe("routeDistance", () => {
  it("parses OSRM when no ORS key", async () => {
    const fetchMock = vi.fn(async () => ok({ code: "Ok", routes: [{ distance: 23456, duration: 2100 }] }));
    const r = await routeDistance(A, B, { ...noThrottle, fetch: fetchMock as never, env: {} });
    expect(r).toEqual({ km: 23.5, minutes: 35, method: "ROAD", provider: "osrm" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(String(url)).toContain("router.project-osrm.org/route/v1/driving/23.73,37.98;23.8,38");
    expect(init.headers).toMatchObject({ "User-Agent": expect.stringContaining("Orithon-PropertyManagement") });
  });

  it("prefers ORS when ORS_API_KEY is set", async () => {
    const fetchMock = vi.fn(async () => ok({ routes: [{ summary: { distance: 10000, duration: 600 } }] }));
    const r = await routeDistance(A, B, { ...noThrottle, fetch: fetchMock as never, env: { ORS_API_KEY: "k" } });
    expect(r).toEqual({ km: 10, minutes: 10, method: "ROAD", provider: "ors" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(String(url)).toContain("api.openrouteservice.org/v2/directions/driving-car");
    expect(init.headers).toMatchObject({ Authorization: "k" });
    expect(JSON.parse(String(init.body))).toEqual({ coordinates: [[23.73, 37.98], [23.8, 38]] });
  });

  it("falls back to the estimate on NoRoute, non-200, throw and timeout", async () => {
    const est = estimateRoute(A, B);
    const failures = [
      vi.fn(async () => ok({ code: "NoRoute", routes: [] })),
      vi.fn(async () => ({ ok: false, status: 429, json: async () => ({}) }) as unknown as Response),
      vi.fn(async () => { throw new Error("net"); }),
    ];
    for (const f of failures) expect(await routeDistance(A, B, { ...noThrottle, fetch: f as never, env: {} })).toEqual(est);
    const hanging = vi.fn((_: string, init?: RequestInit) => new Promise<Response>((_, rej) => init?.signal?.addEventListener("abort", () => rej(new Error("aborted")))));
    expect(await routeDistance(A, B, { ...noThrottle, fetch: hanging as never, env: {}, timeoutMs: 5 })).toEqual(est);
  });

  it("estimate = haversine × 1.3 at 50 km/h, ESTIMATE/haversine", () => {
    expect(estimateRoute(A, A)).toEqual({ km: 0, minutes: 0, method: "ESTIMATE", provider: "haversine" });
    const r = estimateRoute(A, B);
    expect(r.method).toBe("ESTIMATE");
    expect(r.provider).toBe("haversine");
    expect(r.km).toBeCloseTo(8.4, 0); // ≈6.5 km straight line × 1.3
    expect(r.minutes).toBe(Math.round((r.km / 50) * 60));
  });
});
