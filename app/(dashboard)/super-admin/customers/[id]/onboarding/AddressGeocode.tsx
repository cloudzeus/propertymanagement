"use client";

import { useEffect, useRef, useState } from "react";
import { RiMapPin2Line } from "react-icons/ri";
import { PropertyMap } from "@/components/maps/PropertyMap";

type Resolved = { city?: string; postalCode?: string; lat: number; lng: number; displayName: string };

export function AddressGeocode({ address, onResolved }: { address?: string; onResolved: (r: Resolved | null) => void }) {
  const [res, setRes] = useState<Resolved | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!address || address.trim().length < 4) {
      timer.current = setTimeout(() => { setRes(null); onResolved(null); }, 0);
      return () => { if (timer.current) clearTimeout(timer.current); };
    }
    timer.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/geocode?address=${encodeURIComponent(address)}`);
        const data = await r.json();
        const first = data?.results?.[0];
        if (first) { const out: Resolved = { city: first.city, postalCode: first.postalCode, lat: first.lat, lng: first.lng, displayName: first.displayName }; setRes(out); onResolved(out); }
        else { setRes(null); onResolved(null); }
      } catch { setRes(null); onResolved(null); }
    }, 600);
    return () => { if (timer.current) clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  if (!res) return null;
  return (
    <div style={{ marginTop: 8, border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", maxWidth: 360 }}>
      <PropertyMap lat={res.lat} lng={res.lng} height={140} zoom={15} />
      <div style={{ padding: 8, fontSize: 12, color: "var(--muted-foreground, #666)", display: "flex", alignItems: "center", gap: 4 }}>
        <RiMapPin2Line /> {res.city || res.displayName}{res.postalCode ? ` · ΤΚ ${res.postalCode}` : ""}
      </div>
    </div>
  );
}
