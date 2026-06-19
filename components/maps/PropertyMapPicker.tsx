"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Map, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { RiMapPin2Line, RiSearchLine, RiLoaderLine, RiCrosshairLine } from "react-icons/ri";

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_API_KEY!;

type GeoResult = {
  lat: number;
  lng: number;
  displayName: string;
  confidence?: number;
};

type Props = {
  initialLat?: number | null;
  initialLng?: number | null;
  initialAddress?: string;
  onLocationChange?: (lat: number, lng: number, displayName?: string) => void;
  height?: number | string;
  /** Hidden inputs for form submission */
  latName?: string;
  lngName?: string;
  /** Imperatively move the pin + fly to a location (e.g. after address autocomplete).
   *  Changing `focusNonce` triggers the move. */
  focusLat?: number | null;
  focusLng?: number | null;
  focusNonce?: number;
  /** Show the built-in address search bar above the map. Default true. */
  showSearch?: boolean;
};

/**
 * Interactive map picker — drag the pin, click to place, or geocode an address.
 * Emits lat/lng changes via onLocationChange and writes to hidden form inputs.
 */
export function PropertyMapPicker({
  initialLat,
  initialLng,
  initialAddress = "",
  onLocationChange,
  height = 420,
  latName = "lat",
  lngName = "lng",
  focusLat,
  focusLng,
  focusNonce,
  showSearch = true,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const markerRef = useRef<Marker | null>(null);

  const [lat, setLat] = useState<number | null>(initialLat ?? null);
  const [lng, setLng] = useState<number | null>(initialLng ?? null);
  const [query, setQuery] = useState(initialAddress);
  const [results, setResults] = useState<GeoResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [reverseLoading, setReverseLoading] = useState(false);
  const [displayName, setDisplayName] = useState<string>("");

  const DEFAULT_CENTER: [number, number] = [23.7275, 37.9838]; // Athens
  const initialCenter: [number, number] =
    initialLng && initialLat ? [initialLng, initialLat] : DEFAULT_CENTER;

  const updateMarker = useCallback((newLng: number, newLat: number) => {
    const map = mapRef.current;
    if (!map) return;
    import("maplibre-gl").then(({ default: maplibregl }) => {
      if (markerRef.current) {
        markerRef.current.setLngLat([newLng, newLat]);
      } else {
        markerRef.current = new maplibregl.Marker({ color: "#0078D4", draggable: true })
          .setLngLat([newLng, newLat])
          .addTo(map);

        markerRef.current.on("dragend", () => {
          const pos = markerRef.current!.getLngLat();
          setLat(pos.lat);
          setLng(pos.lng);
          onLocationChange?.(pos.lat, pos.lng);
          doReverseGeocode(pos.lat, pos.lng);
        });
      }
    });
    setLat(newLat);
    setLng(newLng);
    onLocationChange?.(newLat, newLng);
  }, [onLocationChange]);

  useEffect(() => {
    if (!containerRef.current) return;
    let map: Map;

    import("maplibre-gl").then(({ default: maplibregl }) => {
      map = new maplibregl.Map({
        container: containerRef.current!,
        style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`,
        center: initialCenter,
        zoom: initialLat ? 15 : 6,
        attributionControl: false,
      });

      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");

      // Some MapTiler sprite icons occasionally fail to load and spam the
      // console with "Image X could not be loaded" warnings. Supply a 1×1
      // transparent placeholder for any missing image to silence them.
      map.on("styleimagemissing", (e: { id: string }) => {
        if (map.hasImage(e.id)) return;
        map.addImage(e.id, { width: 1, height: 1, data: new Uint8Array(4) });
      });

      map.on("load", () => {
        if (initialLat && initialLng) {
          markerRef.current = new maplibregl.Marker({ color: "#0078D4", draggable: true })
            .setLngLat([initialLng, initialLat])
            .addTo(map);

          markerRef.current.on("dragend", () => {
            const pos = markerRef.current!.getLngLat();
            setLat(pos.lat);
            setLng(pos.lng);
            onLocationChange?.(pos.lat, pos.lng);
            doReverseGeocode(pos.lat, pos.lng);
          });
        }
      });

      // Click to place/move marker
      map.on("click", (e) => {
        const { lng: clickLng, lat: clickLat } = e.lngLat;
        if (!markerRef.current) {
          markerRef.current = new maplibregl.Marker({ color: "#0078D4", draggable: true })
            .setLngLat([clickLng, clickLat])
            .addTo(map);

          markerRef.current.on("dragend", () => {
            const pos = markerRef.current!.getLngLat();
            setLat(pos.lat);
            setLng(pos.lng);
            onLocationChange?.(pos.lat, pos.lng);
            doReverseGeocode(pos.lat, pos.lng);
          });
        } else {
          markerRef.current.setLngLat([clickLng, clickLat]);
        }
        setLat(clickLat);
        setLng(clickLng);
        onLocationChange?.(clickLat, clickLng);
        doReverseGeocode(clickLat, clickLng);
      });

      mapRef.current = map;
    });

    return () => {
      map?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Imperative focus — when focusNonce changes, place the pin + fly there.
  useEffect(() => {
    if (focusNonce === undefined || focusLat == null || focusLng == null) return;
    let cancelled = false;
    const apply = () => {
      const map = mapRef.current;
      if (!map) { if (!cancelled) setTimeout(apply, 150); return; }
      updateMarker(focusLng, focusLat);
      map.flyTo({ center: [focusLng, focusLat], zoom: 16 });
    };
    apply();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusNonce]);

  async function doSearch() {
    if (!query.trim()) return;
    setSearching(true);
    setResults([]);
    try {
      const res = await fetch(`/api/geocode?address=${encodeURIComponent(query)}`);
      const data: { results: GeoResult[] } = await res.json();
      setResults(data.results || []);
    } finally {
      setSearching(false);
    }
  }

  async function doReverseGeocode(lat: number, lng: number) {
    setReverseLoading(true);
    try {
      const res = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`);
      const data: { displayName?: string } = await res.json();
      if (data.displayName) setDisplayName(data.displayName);
    } finally {
      setReverseLoading(false);
    }
  }

  function selectResult(r: GeoResult) {
    setResults([]);
    setQuery(r.displayName);
    setDisplayName(r.displayName);
    updateMarker(r.lng, r.lat);
    mapRef.current?.flyTo({ center: [r.lng, r.lat], zoom: 15 });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Search bar */}
      {showSearch && (
      <div style={{ position: "relative" }}>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1, position: "relative" }}>
            <RiMapPin2Line style={{
              position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
              fontSize: 16, color: "var(--muted-foreground)",
            }} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doSearch()}
              placeholder="Αναζήτηση διεύθυνσης…"
              style={{
                width: "100%", padding: "9px 12px 9px 34px",
                border: "1px solid var(--border)", borderRadius: 6,
                fontSize: 13, color: "var(--foreground)",
                background: "var(--bg-canvas)", outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
          <button
            type="button"
            onClick={doSearch}
            disabled={searching}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "0 14px", borderRadius: 6,
              background: "var(--color-primary)", color: "#fff",
              border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
              whiteSpace: "nowrap",
            }}
          >
            {searching
              ? <RiLoaderLine style={{ fontSize: 15, animation: "spin 1s linear infinite" }} />
              : <RiSearchLine style={{ fontSize: 15 }} />
            }
            Geocoding
          </button>
        </div>

        {/* Results dropdown */}
        {results.length > 0 && (
          <div style={{
            position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100,
            background: "var(--card)", border: "1px solid var(--border)",
            borderRadius: 6, marginTop: 4, boxShadow: "0 4px 16px rgba(0,0,0,.12)",
            overflow: "hidden",
          }}>
            {results.map((r, i) => (
              <button
                key={i}
                type="button"
                onClick={() => selectResult(r)}
                style={{
                  display: "flex", alignItems: "flex-start", gap: 8,
                  width: "100%", padding: "10px 14px", border: "none",
                  background: "transparent", cursor: "pointer", textAlign: "left",
                  borderBottom: i < results.length - 1 ? "1px solid var(--border)" : "none",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-canvas)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <RiMapPin2Line style={{ fontSize: 15, color: "var(--color-primary)", flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 13, color: "var(--foreground)", lineHeight: 1.4 }}>{r.displayName}</span>
                {r.confidence !== undefined && (
                  <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--muted-foreground)", flexShrink: 0 }}>
                    {Math.round(r.confidence * 100)}%
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
      )}

      {/* Map */}
      <div
        ref={containerRef}
        style={{
          height,
          width: "100%",
          borderRadius: 8,
          overflow: "hidden",
          border: "1px solid var(--border)",
          cursor: "crosshair",
        }}
      />

      {/* Coordinates + reverse geocode result */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 12, color: "var(--muted-foreground)" }}>
        <RiCrosshairLine style={{ fontSize: 14, flexShrink: 0 }} />
        {lat !== null && lng !== null ? (
          <span>
            <strong style={{ color: "var(--foreground)" }}>{lat.toFixed(6)}</strong>
            {", "}
            <strong style={{ color: "var(--foreground)" }}>{lng.toFixed(6)}</strong>
            {reverseLoading && " — αντίστροφη γεωκωδικοποίηση…"}
            {!reverseLoading && displayName && ` — ${displayName.split(",").slice(0, 3).join(", ")}`}
          </span>
        ) : (
          <span>Κάντε κλικ στον χάρτη ή αναζητήστε διεύθυνση για τοποθέτηση pin</span>
        )}
      </div>

      {/* Hidden form inputs */}
      <input type="hidden" name={latName} value={lat ?? ""} />
      <input type="hidden" name={lngName} value={lng ?? ""} />

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
