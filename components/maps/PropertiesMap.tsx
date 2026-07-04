"use client";

import { useEffect, useRef } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Map } from "maplibre-gl";

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_API_KEY!;

export type PropertyMarker = {
  id: string;
  lat: number;
  lng: number;
  name: string;
  customerName?: string | null;
  city?: string | null;
};

/**
 * Multi-marker map of all properties (MapLibre GL + MapTiler tiles).
 * Fits the view to all markers; each marker has a name/customer popup.
 */
export function PropertiesMap({ markers, missing = [], height = 560 }: { markers: PropertyMarker[]; missing?: string[]; height?: number | string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let map: Map;

    import("maplibre-gl").then(({ default: maplibregl }) => {
      const pts = markers.filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng));
      const first = pts[0];

      map = new maplibregl.Map({
        container: containerRef.current!,
        style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`,
        center: first ? [first.lng, first.lat] : [23.7275, 37.9838], // default: Athens
        zoom: first ? 11 : 6,
        attributionControl: false,
      });

      map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      map.addControl(new maplibregl.FullscreenControl(), "top-right");

      for (const m of pts) {
        const popupHtml = `<strong>${escapeHtml(m.name)}</strong>${m.customerName ? `<br/><span style="color:#666">${escapeHtml(m.customerName)}</span>` : ""}${m.city ? `<br/><span style="color:#666">${escapeHtml(m.city)}</span>` : ""}`;
        new maplibregl.Marker({ color: "#0078D4" })
          .setLngLat([m.lng, m.lat])
          .setPopup(new maplibregl.Popup({ offset: 24, closeButton: false }).setHTML(popupHtml))
          .addTo(map);
      }

      if (pts.length > 1) {
        const bounds = new maplibregl.LngLatBounds();
        for (const m of pts) bounds.extend([m.lng, m.lat]);
        map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 0 });
      }

      mapRef.current = map;
    });

    return () => { map?.remove(); mapRef.current = null; };
  }, [markers]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        ref={containerRef}
        style={{ height, width: "100%", borderRadius: 8, overflow: "hidden", border: "1px solid var(--border)" }}
      />
      {missing.length > 0 && (
        <div style={{ fontSize: 12, color: "var(--muted-foreground)", padding: "8px 10px", borderRadius: 6, background: "#CA5D0014", border: "1px solid #CA5D0033" }}>
          <strong style={{ color: "#CA5D00" }}>{missing.length}</strong> {missing.length === 1 ? "ιδιοκτησία χωρίς" : "ιδιοκτησίες χωρίς"} θέση στον χάρτη: {missing.join(", ")}.
          {" "}Ορίστε συντεταγμένες από την επεξεργασία της ιδιοκτησίας (κουμπί εύρεσης στίγματος).
        </div>
      )}
    </div>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
