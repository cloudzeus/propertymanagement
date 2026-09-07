"use client";

import { useSyncExternalStore } from "react";

/**
 * Subscribe to a CSS media query without setState-in-effect. Server snapshot
 * is `false` (desktop layout), so the first client render matches SSR and the
 * phone layout switches in right after hydration.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export const usePhone = () => useMediaQuery("(max-width: 767px)");
