"use client";

import { useEffect, useRef, startTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * Subscribes to an SSE stream and refreshes the RSC payload on events:
 * a building's stream (`buildingId`) or the company-wide work channel (`scope="company"`).
 */
export function AutoRefresh({ buildingId, scope }: { buildingId?: string; scope?: "company" }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const url = scope === "company" ? "/api/realtime?scope=company" : buildingId ? `/api/realtime?building=${encodeURIComponent(buildingId)}` : null;
    if (!url) return;
    const es = new EventSource(url);
    es.onmessage = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        startTransition(() => router.refresh());
      }, 2000);
    };
    return () => {
      es.close();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [buildingId, scope, router]);

  return null;
}
