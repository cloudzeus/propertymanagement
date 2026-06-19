import "server-only";

const MAPTILER_KEY = process.env.MAPTILER_API_KEY!;
const GEOCODE_KEY = process.env.GEOCODE_API!;

export type GeocodingResult = {
  lat: number;
  lng: number;
  displayName: string;
  confidence?: number;
  // Structured address components (best-effort, from MapTiler context)
  city?: string;
  postalCode?: string;
  country?: string;
};

/** Pull city / postal code / country out of a MapTiler feature's context. */
function parseContext(f: MapTilerFeature): Pick<GeocodingResult, "city" | "postalCode" | "country"> {
  const out: Pick<GeocodingResult, "city" | "postalCode" | "country"> = {};
  const ctx = f.context ?? [];
  for (const c of ctx) {
    const id = c.id ?? "";
    if (id.startsWith("postal_code") && !out.postalCode) out.postalCode = c.text;
    else if ((id.startsWith("municipality") || id.startsWith("municipal_district") || id.startsWith("place")) && !out.city) out.city = c.text;
    else if (id.startsWith("country") && !out.country) out.country = c.text;
  }
  // The feature itself may be a place/municipality (city-level result)
  const pt = f.place_type?.[0];
  if (!out.city && (pt === "place" || pt === "municipality") && f.text) out.city = f.text;
  if (!out.postalCode && pt === "postal_code" && f.text) out.postalCode = f.text;
  return out;
}

/** Forward geocoding: address → coordinates. Tries MapTiler first, falls back to geocode.maps.co */
export async function geocodeAddress(address: string): Promise<GeocodingResult[]> {
  const query = encodeURIComponent(address);

  // MapTiler
  try {
    const res = await fetch(
      `https://api.maptiler.com/geocoding/${query}.json?key=${MAPTILER_KEY}&language=el,en&limit=5`,
      { cache: "no-store" }
    );
    if (res.ok) {
      const data: { features: MapTilerFeature[] } = await res.json();
      if (data.features?.length > 0) {
        return data.features.map((f) => ({
          lat: f.geometry.coordinates[1],
          lng: f.geometry.coordinates[0],
          displayName: f.place_name || f.properties?.name || address,
          confidence: f.relevance,
          ...parseContext(f),
        }));
      }
    }
  } catch { /* fall through */ }

  // Geocode.maps.co fallback
  try {
    const res = await fetch(
      `https://geocode.maps.co/search?q=${query}&api_key=${GEOCODE_KEY}`,
      { cache: "no-store" }
    );
    if (res.ok) {
      const data: GeocodeMapsCo[] = await res.json();
      return (data || []).slice(0, 5).map((r) => ({
        lat: parseFloat(r.lat),
        lng: parseFloat(r.lon),
        displayName: r.display_name,
      }));
    }
  } catch { /* fall through */ }

  return [];
}

/** Reverse geocoding: coordinates → address string. Tries MapTiler first. */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  // MapTiler
  try {
    const res = await fetch(
      `https://api.maptiler.com/geocoding/${lng},${lat}.json?key=${MAPTILER_KEY}&language=el,en`,
      { cache: "no-store" }
    );
    if (res.ok) {
      const data: { features: MapTilerFeature[] } = await res.json();
      if (data.features?.length > 0) return data.features[0].place_name ?? null;
    }
  } catch { /* fall through */ }

  // Geocode.maps.co fallback
  try {
    const res = await fetch(
      `https://geocode.maps.co/reverse?lat=${lat}&lon=${lng}&api_key=${GEOCODE_KEY}`,
      { cache: "no-store" }
    );
    if (res.ok) {
      const data: { display_name?: string } = await res.json();
      return data.display_name ?? null;
    }
  } catch { /* fall through */ }

  return null;
}

// ─── Response types ────────────────────────────────────────────────────────────

type MapTilerFeature = {
  geometry: { coordinates: [number, number] };
  place_name?: string;
  place_type?: string[];
  text?: string;
  relevance?: number;
  properties?: { name?: string };
  context?: { id?: string; text: string }[];
};

type GeocodeMapsCo = {
  lat: string;
  lon: string;
  display_name: string;
};
