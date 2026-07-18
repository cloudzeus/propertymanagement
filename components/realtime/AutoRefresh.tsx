"use client";

import { useEffect, useRef, startTransition } from "react";
import { useRouter } from "next/navigation";

/** Subscribes to the building's SSE stream and refreshes the RSC payload on events. */
export function AutoRefresh({ buildingId }: { buildingId: string }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const es = new EventSource(`/api/realtime?building=${encodeURIComponent(buildingId)}`);
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
  }, [buildingId, router]);

  return null;
}
