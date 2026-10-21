/* Orithon — service worker (PWA, Φάση 1: εγκατάσταση + offline κέλυφος).
 *
 * Κανόνες (δείτε docs/superpowers/specs/2026-10-21-pwa-design.md §3.4):
 *  - Σελίδες (navigate): ΠΑΝΤΑ δίκτυο· αν το δίκτυο αποτύχει → η προ-αποθηκευμένη /offline.
 *    Η απάντηση σελίδας δεν μπαίνει ποτέ σε cache (δεδομένα πελατών, απομόνωση ανά χρήστη).
 *  - /_next/static/*, /icons/*, /apple-icon.png: cache-first (hashed, αμετάβλητα).
 *  - Ό,τι άλλο (API, RSC, /_next/image, SSE, CDN, POST): ο SW δεν παρεμβαίνει.
 *  - ?dev=1 (localhost): χωρίς static cache — τα dev chunks δεν είναι content-hashed (HMR).
 * Κάθε αλλαγή στο PRECACHE ή στους κανόνες → αύξηση του VERSION.
 */
const VERSION = "v1";
const CACHE = "orithon-shell-" + VERSION;
const CACHE_PREFIX = "orithon-shell-";
const OFFLINE_URL = "/offline";
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png", "/icons/icon-512.png", "/icons/maskable-512.png"];
const SELF_URL = new URL(self.location.href);
const DEV = SELF_URL.searchParams.get("dev") === "1";
const ORIGIN = SELF_URL.origin;

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

// Φάση 2 (Web Push): εδώ μπαίνουν οι handlers 'push' και 'notificationclick'.

self.__pwa = { routeFor, VERSION, CACHE, PRECACHE, DEV };
