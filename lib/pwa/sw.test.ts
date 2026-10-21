import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

/**
 * Φορτώνει το public/sw.js σε sandbox (node:vm) με ψεύτικα self/caches/fetch
 * και ελέγχει τους κανόνες του: precache, offline fallback, μη αποθήκευση
 * σελίδων, cache-first static, αδιαφορία για API, dev bypass, καθαρισμό caches.
 */
const ORIGIN = "https://x.test";
type Listener = (event: any) => unknown;

function makeCaches() {
  const stores = new Map<string, Map<string, Response>>();
  const key = (r: Request | string) => (typeof r === "string" ? new URL(r, ORIGIN).href : r.url);
  const openStore = (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    return stores.get(name)!;
  };
  const addAllCalls: Request[][] = [];
  const caches = {
    open: async (name: string) => {
      const store = openStore(name);
      return {
        addAll: async (reqs: Request[]) => {
          addAllCalls.push(reqs);
          for (const r of reqs) store.set(key(r), await (globalThis.fetch as any)(r));
        },
        put: async (r: Request | string, res: Response) => { store.set(key(r), res); },
        match: async (r: Request | string) => store.get(key(r))?.clone(),
      };
    },
    match: async (r: Request | string) => {
      for (const s of stores.values()) { const hit = s.get(key(r)); if (hit) return hit.clone(); }
      return undefined;
    },
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
  };
  return { caches, stores, addAllCalls, openStore };
}

function loadSw({ dev = false } = {}) {
  const code = readFileSync(path.resolve(__dirname, "../../public/sw.js"), "utf8");
  const listeners: Record<string, Listener[]> = {};
  const fetch = vi.fn();
  const { caches, stores, addAllCalls, openStore } = makeCaches();
  const self = {
    addEventListener: (type: string, fn: Listener) => { (listeners[type] ??= []).push(fn); },
    skipWaiting: vi.fn(async () => {}),
    clients: { claim: vi.fn(async () => {}) },
    location: { href: `${ORIGIN}/sw.js${dev ? "?dev=1" : ""}` },
  };
  // Στον πραγματικό SW τα σχετικά URL λύνονται ως προς το self.location· στο Node όχι.
  class SwRequest extends Request {
    constructor(input: RequestInfo | URL, init?: RequestInit) {
      super(typeof input === "string" ? new URL(input, ORIGIN).href : input, init);
    }
  }
  const sandbox: Record<string, unknown> = { self, caches, fetch, Request: SwRequest, Response, URL, console };
  (sandbox as any).globalThis = sandbox;
  vm.runInNewContext(code, sandbox);
  // το sandbox fetch είναι ο ίδιος mock που καλεί και το addAll του stub
  (globalThis as any).fetch = fetch;
  const pwa = (self as any).__pwa as { routeFor: (r: Request, origin: string, dev: boolean) => string; VERSION: string; CACHE: string; PRECACHE: string[]; DEV: boolean };
  const fire = async (type: string, event: Record<string, unknown> = {}) => {
    const waits: Promise<unknown>[] = [];
    const ev = { ...event, waitUntil: (p: Promise<unknown>) => waits.push(p) };
    for (const fn of listeners[type] ?? []) await fn(ev);
    await Promise.all(waits);
    return ev;
  };
  const fetchEvent = async (request: Request): Promise<Response | undefined> => {
    let responded: Promise<Response> | undefined;
    const ev = { request, respondWith: (p: Promise<Response> | Response) => { responded = Promise.resolve(p); }, waitUntil: () => {} };
    for (const fn of listeners["fetch"] ?? []) fn(ev);
    return responded ? await responded : undefined;
  };
  return { self, listeners, stores, addAllCalls, openStore, fetch, pwa, fire, fetchEvent };
}

/** Το Node Request δεν δέχεται mode "navigate" — το ορίζουμε ως own property. */
const nav = (p: string) => {
  const r = new Request(ORIGIN + p);
  Object.defineProperty(r, "mode", { value: "navigate" });
  return r;
};
const realFetch = globalThis.fetch;
beforeEach(() => { (globalThis as any).fetch = realFetch; });

describe("sw.js routeFor", () => {
  const { pwa } = loadSw();
  const r = (req: Request, dev = false) => pwa.routeFor(req, ORIGIN, dev);
  it("routes page navigations to navigate", () => expect(r(nav("/admin/work"))).toBe("navigate"));
  it("routes hashed static assets and icons to static", () => {
    expect(r(new Request(ORIGIN + "/_next/static/chunks/a.js"))).toBe("static");
    expect(r(new Request(ORIGIN + "/icons/icon-192.png"))).toBe("static");
    expect(r(new Request(ORIGIN + "/apple-icon.png"))).toBe("static");
  });
  it("bypasses API, RSC payloads, POST and cross-origin", () => {
    expect(r(new Request(ORIGIN + "/api/notifications"))).toBe("bypass");
    expect(r(new Request(ORIGIN + "/portal?_rsc=abc", { mode: "cors" } as RequestInit))).toBe("bypass");
    expect(r(new Request(ORIGIN + "/admin/work", { method: "POST" }))).toBe("bypass");
    expect(r(new Request("https://cdn.example/x.js"))).toBe("bypass");
    expect(r(new Request(ORIGIN + "/_next/image?url=x"))).toBe("bypass");
  });
  it("bypasses static in dev mode (Turbopack chunks are not content-hashed)", () => {
    expect(r(new Request(ORIGIN + "/_next/static/chunks/a.js"), true)).toBe("bypass");
    expect(loadSw({ dev: true }).pwa.DEV).toBe(true);
  });
});

describe("sw.js lifecycle", () => {
  it("install precaches /offline and the icons with cache:'reload' and skips waiting", async () => {
    const sw = loadSw();
    sw.fetch.mockImplementation(async () => new Response("ok"));
    await sw.fire("install");
    const store = sw.stores.get(sw.pwa.CACHE)!;
    expect([...store.keys()]).toEqual([
      `${ORIGIN}/offline`, `${ORIGIN}/icons/icon-192.png`, `${ORIGIN}/icons/icon-512.png`, `${ORIGIN}/icons/maskable-512.png`,
    ]);
    expect(sw.addAllCalls[0].every((req) => req.cache === "reload")).toBe(true);
    expect(sw.self.skipWaiting).toHaveBeenCalled();
  });
  it("activate deletes other orithon-shell caches, keeps foreign ones, claims clients", async () => {
    const sw = loadSw();
    sw.openStore("orithon-shell-v0"); sw.openStore("other-app"); sw.openStore(sw.pwa.CACHE);
    await sw.fire("activate");
    expect([...sw.stores.keys()].sort()).toEqual(["other-app", sw.pwa.CACHE].sort());
    expect(sw.self.clients.claim).toHaveBeenCalled();
  });
  it("message SKIP_WAITING calls skipWaiting", async () => {
    const sw = loadSw();
    await sw.fire("message", { data: { type: "SKIP_WAITING" } });
    expect(sw.self.skipWaiting).toHaveBeenCalledTimes(1);
  });
});

describe("sw.js fetch — navigations", () => {
  it("falls back to the cached /offline when the network fails", async () => {
    const sw = loadSw();
    sw.openStore(sw.pwa.CACHE).set(`${ORIGIN}/offline`, new Response("OFFLINE"));
    sw.fetch.mockRejectedValue(new TypeError("Failed to fetch"));
    const res = await sw.fetchEvent(nav("/admin/work"));
    expect(await res!.text()).toBe("OFFLINE");
  });
  it("passes an HTTP error response through unchanged (only network failure falls back)", async () => {
    const sw = loadSw();
    sw.openStore(sw.pwa.CACHE).set(`${ORIGIN}/offline`, new Response("OFFLINE"));
    sw.fetch.mockResolvedValue(new Response("boom", { status: 500 }));
    const res = await sw.fetchEvent(nav("/admin/work"));
    expect(res!.status).toBe(500);
    expect(await res!.text()).toBe("boom");
  });
  it("never caches a successful page", async () => {
    const sw = loadSw();
    sw.fetch.mockResolvedValue(new Response("page"));
    await sw.fetchEvent(nav("/admin/work"));
    for (const s of sw.stores.values()) expect(s.has(`${ORIGIN}/admin/work`)).toBe(false);
  });
  it("returns a 503 text response when /offline is not cached either", async () => {
    const sw = loadSw();
    sw.fetch.mockRejectedValue(new TypeError("Failed to fetch"));
    const res = await sw.fetchEvent(nav("/portal"));
    expect(res!.status).toBe(503);
  });
});

describe("sw.js fetch — static shell", () => {
  it("is cache-first: second request served from cache without fetching", async () => {
    const sw = loadSw();
    sw.fetch.mockImplementation(async () => new Response("js", { status: 200 }));
    const req = () => new Request(ORIGIN + "/_next/static/chunks/a.js");
    await sw.fetchEvent(req());
    await new Promise((r) => setTimeout(r, 0));
    expect(sw.stores.get(sw.pwa.CACHE)?.has(`${ORIGIN}/_next/static/chunks/a.js`)).toBe(true);
    const res = await sw.fetchEvent(req());
    expect(await res!.text()).toBe("js");
    expect(sw.fetch).toHaveBeenCalledTimes(1);
  });
  it("does not cache a non-ok static response", async () => {
    const sw = loadSw();
    sw.fetch.mockResolvedValue(new Response("nope", { status: 404 }));
    const req = () => new Request(ORIGIN + "/_next/static/chunks/old.js");
    await sw.fetchEvent(req());
    await new Promise((r) => setTimeout(r, 0));
    expect(sw.stores.get(sw.pwa.CACHE)?.has(`${ORIGIN}/_next/static/chunks/old.js`) ?? false).toBe(false);
    await sw.fetchEvent(req());
    expect(sw.fetch).toHaveBeenCalledTimes(2);
  });
  it("never calls respondWith for bypassed requests", async () => {
    const sw = loadSw();
    expect(await sw.fetchEvent(new Request(ORIGIN + "/api/notifications"))).toBeUndefined();
    expect(sw.fetch).not.toHaveBeenCalled();
  });
});
