import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

const GOOGLE_KEY = process.env.GOOGLE_LOCATION_KEY ?? process.env.GOOGLE_MAPS_API_KEY ?? process.env.GEMINI_API_KEY;

export type PlaceDetails = {
  formattedAddress: string;
  address: string;
  district: string;
  city: string;
  postalCode: string;
  country: string;
  lat: number | null;
  lng: number | null;
};

function comp(components: any[], type: string, field: "longText" | "shortText" = "longText"): string {
  const c = components.find((x) => Array.isArray(x.types) && x.types.includes(type));
  return c?.[field] ?? "";
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!GOOGLE_KEY) {
    return NextResponse.json({ error: "GOOGLE_MAPS_API_KEY not configured" }, { status: 500 });
  }

  const placeId = req.nextUrl.searchParams.get("placeId")?.trim();
  const sessionToken = req.nextUrl.searchParams.get("token") || undefined;
  if (!placeId) {
    return NextResponse.json({ error: "placeId required" }, { status: 400 });
  }

  try {
    const url = new URL(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`);
    url.searchParams.set("languageCode", "el");
    if (sessionToken) url.searchParams.set("sessionToken", sessionToken);

    const res = await fetch(url, {
      headers: {
        "X-Goog-Api-Key": GOOGLE_KEY,
        "X-Goog-FieldMask": "formattedAddress,location,addressComponents",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const detail = await res.text();
      return NextResponse.json({ error: "Google details failed", detail }, { status: 502 });
    }

    const data = await res.json();
    const components: any[] = data.addressComponents ?? [];

    const route = comp(components, "route");
    const streetNumber = comp(components, "street_number");
    const street = [route, streetNumber].filter(Boolean).join(" ").trim();

    const details: PlaceDetails = {
      formattedAddress: data.formattedAddress ?? "",
      address: street || data.formattedAddress?.split(",")[0] || "",
      district:
        comp(components, "administrative_area_level_1") ||
        comp(components, "administrative_area_level_3") ||
        comp(components, "administrative_area_level_2"),
      city:
        comp(components, "locality") ||
        comp(components, "postal_town") ||
        comp(components, "administrative_area_level_3"),
      postalCode: comp(components, "postal_code"),
      country: comp(components, "country"),
      lat: data.location?.latitude ?? null,
      lng: data.location?.longitude ?? null,
    };

    return NextResponse.json({ details });
  } catch {
    return NextResponse.json({ error: "Network error" }, { status: 502 });
  }
}
