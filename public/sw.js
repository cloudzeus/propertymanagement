/* Orithon — service worker (PWA, Φάση 1: εγκατάσταση + offline κέλυφος · Φάση 2: Web Push).
 *
 * Κανόνες (δείτε docs/superpowers/specs/2026-10-21-pwa-design.md §3.4):
 *  - Σελίδες (navigate): ΠΑΝΤΑ δίκτυο· αν το δίκτυο αποτύχει → η προ-αποθηκευμένη /offline.
 *    Η απάντηση σελίδας δεν μπαίνει ποτέ σε cache (δεδομένα πελατών, απομόνωση ανά χρήστη).
 *  - /_next/static/*, /icons/*, /apple-icon.png: cache-first (hashed, αμετάβλητα).
 *  - Ό,τι άλλο (API, RSC, /_next/image, SSE, CDN, POST): ο SW δεν παρεμβαίνει.
 *  - ?dev=1 (localhost): χωρίς static cache — τα dev chunks δεν είναι content-hashed (HMR).
 *  - push: δείχνει ειδοποίηση από το JSON payload (lib/push/send.ts buildPushPayload).
 *  - notificationclick: εστίαση ανοιχτού παραθύρου της εφαρμογής + πλοήγηση στο href, αλλιώς νέο παράθυρο.
 * Κάθε αλλαγή στο PRECACHE ή στους κανόνες → αύξηση του VERSION.
 */
const VERSION = "v2";
const CACHE = "orithon-shell-" + VERSION;
const CACHE_PREFIX = "orithon-shell-";
const OFFLINE_URL = "/offline";
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png", "/icons/icon-512.png", "/icons/maskable-512.png"];
const SELF_URL = new URL(self.location.href);
const DEV = SELF_URL.searchParams.get("dev") === "1";
const ORIGIN = SELF_URL.origin;

/** Η cached /offline ανανεώνεται μία φορά ανά ζωή του SW (σε κάθε deploy αλλάζουν τα chunks που αναφέρει). */
let offlineRefreshed = false;
let offlineRefreshing = null;
function refreshOffline() {
  if (offlineRefreshed || offlineRefreshing) return offlineRefreshing || Promise.resolve();
  offlineRefreshing = fetch(new Request(OFFLINE_URL, { cache: "reload" }))
    .then((res) => {
      if (!res.ok) return;
      offlineRefreshed = true;
      return caches.open(CACHE).then((cache) => cache.put(OFFLINE_URL, res));
    })
    .catch(() => {})
    .then(() => { offlineRefreshing = null; });
  return offlineRefreshing;
}

/** "navigate" | "static" | "bypass" — καθαρή συνάρτηση, ελέγχεται στο lib/pwa/sw.test.ts. */
function routeFor(request, origin, dev) {
  if (request.method !== "GET") return "bypass";
  const url = new URL(request.url);
  if (url.origin !== origin) return "bypass";
  if (request.mode === "navigate") return "navigate";
  const p = url.pathname;
  const isStatic = p.startsWith("/_next/static/") || p.startsWith("/icons/") || p === "/apple-icon.png";
  if (isStatic) return dev ? "bypass" : "static";
  return "bypass";
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE.map((u) => new Request(u, { cache: "reload" }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const route = routeFor(request, ORIGIN, DEV);
  if (route === "navigate") {
    if (!offlineRefreshed) event.waitUntil(refreshOffline());
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(OFFLINE_URL).then(
          (cached) =>
            cached ||
            new Response("Χωρίς σύνδεση", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } }),
        ),
      ),
    );
    return;
  }
  if (route === "static") {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return res;
          }),
      ),
    );
  }
  // bypass: τίποτα — ο browser κάνει το αίτημα κανονικά.
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

// ---- Φάση 2: Web Push ---------------------------------------------------------
const NOTIFICATION_ICON = "/icons/icon-192.png";
const DEFAULT_HREF = "/home";

/** Καθαρή: payload (JSON ή κείμενο ή τίποτα) → { title, options } για showNotification. */
function notificationFor(data) {
  let payload = null;
  if (data) {
    try { payload = data.json(); } catch (_) { payload = null; }
    if (!payload || typeof payload !== "object") {
      let text = "";
      try { text = data.text(); } catch (_) { text = ""; }
      payload = text ? { title: text } : null;
    }
  }
  const title = (payload && payload.title) || "Orithon";
  const href = (payload && typeof payload.href === "string" && payload.href) || DEFAULT_HREF;
  const options = {
    body: (payload && payload.body) || undefined,
    icon: NOTIFICATION_ICON,
    badge: NOTIFICATION_ICON,
    tag: (payload && payload.tag) || href,
    renotify: true,
    data: { href },
  };
  return { title, options };
}

self.addEventListener("push", (event) => {
  const n = notificationFor(event.data);
  event.waitUntil(self.registration.showNotification(n.title, n.options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = (event.notification.data && event.notification.data.href) || DEFAULT_HREF;
  const target = new URL(href, ORIGIN).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const own = (list || []).find((c) => typeof c.url === "string" && new URL(c.url).origin === ORIGIN);
      if (own) {
        return Promise.resolve(own.focus ? own.focus() : own).then((c) => {
          const client = c || own;
          return client.navigate ? client.navigate(target) : client;
        });
      }
      return self.clients.openWindow(target);
    }),
  );
});

self.__pwa = { routeFor, notificationFor, VERSION, CACHE, PRECACHE, DEV };
