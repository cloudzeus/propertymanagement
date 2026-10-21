/* eslint-disable @typescript-eslint/no-explicit-any -- sandbox stubs for the service-worker globals */
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
    clients: {
      claim: vi.fn(async () => {}),
      matchAll: vi.fn<(q?: unknown) => Promise<any[]>>(async () => []),
      openWindow: vi.fn<(url: string) => Promise<unknown>>(async () => null),
    },
    registration: { showNotification: vi.fn<(title: string, opts: any) => Promise<void>>(async () => {}) },
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
  it("refreshes the precached /offline once per SW lifetime after a successful navigation (tracks the current build)", async () => {
    const sw = loadSw();
    sw.openStore(sw.pwa.CACHE).set(`${ORIGIN}/offline`, new Response("OLD"));
    sw.fetch.mockImplementation(async (req: Request) => new Response(req.url.endsWith("/offline") ? "NEW" : "page"));
    await sw.fetchEvent(nav("/admin/work"));
    await sw.fetchEvent(nav("/portal"));
    await new Promise((r) => setTimeout(r, 0));
    const offlineFetches = sw.fetch.mock.calls.filter(([req]) => (req as Request).url === `${ORIGIN}/offline`);
    expect(offlineFetches).toHaveLength(1);
    expect((offlineFetches[0][0] as Request).cache).toBe("reload");
    expect(await (await sw.openStore(sw.pwa.CACHE).get(`${ORIGIN}/offline`))!.text()).toBe("NEW");
  });
  it("keeps the old /offline when the refresh fetch fails or is not ok", async () => {
    const sw = loadSw();
    sw.openStore(sw.pwa.CACHE).set(`${ORIGIN}/offline`, new Response("OLD"));
    sw.fetch.mockImplementation(async (req: Request) => (req.url.endsWith("/offline") ? new Response("err", { status: 500 }) : new Response("page")));
    await sw.fetchEvent(nav("/admin/work"));
    await new Promise((r) => setTimeout(r, 0));
    expect(await (await sw.openStore(sw.pwa.CACHE).get(`${ORIGIN}/offline`))!.text()).toBe("OLD");
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

describe("sw.js push (Φάση 2)", () => {
  it("is version v2", () => expect(loadSw().pwa.VERSION).toBe("v2"));
  it("shows a notification from the JSON payload with icon, badge, tag and data.href", async () => {
    const sw = loadSw();
    const payload = { title: "Νέα προσφορά", body: "Ποσό 120 €", href: "/admin/work-orders", tag: "/admin/work-orders" };
    await sw.fire("push", { data: { json: () => payload, text: () => JSON.stringify(payload) } });
    expect(sw.self.registration.showNotification).toHaveBeenCalledTimes(1);
    const [title, opts] = sw.self.registration.showNotification.mock.calls[0];
    expect(title).toBe("Νέα προσφορά");
    expect(opts).toMatchObject({ body: "Ποσό 120 €", icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", tag: "/admin/work-orders", data: { href: "/admin/work-orders" } });
  });
  it("falls back to the raw text as title when the payload is not JSON (DevTools «Push»)", async () => {
    const sw = loadSw();
    await sw.fire("push", { data: { json: () => { throw new SyntaxError("x"); }, text: () => "hello" } });
    const [title, opts] = sw.self.registration.showNotification.mock.calls[0];
    expect(title).toBe("hello");
    expect(opts.data.href).toBe("/home");
  });
  it("shows a generic notification when the push has no data at all", async () => {
    const sw = loadSw();
    await sw.fire("push", { data: null });
    expect(sw.self.registration.showNotification.mock.calls[0][0]).toBe("Orithon");
  });
  it("notificationclick focuses an open same-origin window and navigates it to href", async () => {
    const sw = loadSw();
    const client = { url: `${ORIGIN}/portal`, focus: vi.fn(async () => client), navigate: vi.fn(async () => client) };
    sw.self.clients.matchAll.mockResolvedValue([client]);
    const notification = { close: vi.fn(), data: { href: "/portal/requests/1" } };
    await sw.fire("notificationclick", { notification });
    expect(notification.close).toHaveBeenCalled();
    expect(client.focus).toHaveBeenCalled();
    expect(client.navigate).toHaveBeenCalledWith(`${ORIGIN}/portal/requests/1`);
    expect(sw.self.clients.openWindow).not.toHaveBeenCalled();
  });
  it("notificationclick opens a new window when none is open (and /home without href)", async () => {
    const sw = loadSw();
    sw.self.clients.matchAll.mockResolvedValue([]);
    await sw.fire("notificationclick", { notification: { close: vi.fn(), data: {} } });
    expect(sw.self.clients.openWindow).toHaveBeenCalledWith(`${ORIGIN}/home`);
  });
  it("notificationclick ignores a foreign-origin client", async () => {
    const sw = loadSw();
    const foreign = { url: "https://other.test/x", focus: vi.fn(), navigate: vi.fn() };
    sw.self.clients.matchAll.mockResolvedValue([foreign]);
    await sw.fire("notificationclick", { notification: { close: vi.fn(), data: { href: "/x" } } });
    expect(foreign.focus).not.toHaveBeenCalled();
    expect(sw.self.clients.openWindow).toHaveBeenCalledWith(`${ORIGIN}/x`);
  });
});
