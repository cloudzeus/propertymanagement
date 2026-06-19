"use client";

import { useEffect, useRef } from "react";
import type { Map, Marker, NavigationControl } from "maplibre-gl";

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_API_KEY!;

type Props = {
  lat: number;
  lng: number;
  name?: string;
  zoom?: number;
  height?: number | string;
};

/**
 * Static property map — shows a pin at the given coordinates.
 * Uses MapLibre GL (OSS) + MapTiler free tiles.
 */
export function PropertyMap({ lat, lng, name, zoom = 15, height = 360 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let map: Map;
    let marker: Marker;

    import("maplibre-gl").then(({ default: maplibregl }) => {
      map = new maplibregl.Map({
        container: containerRef.current!,
        style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`,
        center: [lng, lat],
        zoom,
        attributionControl: false,
      });

      map.addControl(
        new maplibregl.AttributionControl({ compact: true }),
        "bottom-right"
      );
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      map.addControl(new maplibregl.FullscreenControl(), "top-right");

      marker = new maplibregl.Marker({ color: "#0078D4" })
        .setLngLat([lng, lat])
        .addTo(map);

      if (name) {
        marker.setPopup(
          new maplibregl.Popup({ offset: 25, closeButton: false })
            .setText(name)
        );
      }

      mapRef.current = map;
    });

    return () => {
      map?.remove();
      mapRef.current = null;
    };
  }, [lat, lng, name, zoom]);

  return (
    <div
      ref={containerRef}
      style={{
        height,
        width: "100%",
        borderRadius: 8,
        overflow: "hidden",
        border: "1px solid var(--border)",
      }}
    />
  );
}
