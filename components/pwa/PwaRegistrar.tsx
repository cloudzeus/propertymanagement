"use client";

import { useEffect } from "react";

/**
 * Εγγράφει τον service worker (public/sw.js) σε κάθε σελίδα — και στο login —
 * ώστε η σελίδα /offline να δουλεύει παντού. Σε dev: ?dev=1 → χωρίς static cache (HMR).
 */
export function PwaRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const url = process.env.NODE_ENV === "production" ? "/sw.js" : "/sw.js?dev=1";
    navigator.serviceWorker
      .register(url, { scope: "/", updateViaCache: "none" })
      .catch((e) => console.warn("[pwa] service worker", e));
  }, []);
  return null;
}
