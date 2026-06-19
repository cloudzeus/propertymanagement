import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

const GOOGLE_KEY = process.env.GOOGLE_LOCATION_KEY ?? process.env.GOOGLE_MAPS_API_KEY ?? process.env.GEMINI_API_KEY;

export type PlacePrediction = {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
};

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!GOOGLE_KEY) {
    return NextResponse.json({ error: "GOOGLE_MAPS_API_KEY not configured" }, { status: 500 });
  }

  const input = req.nextUrl.searchParams.get("input")?.trim();
  const sessionToken = req.nextUrl.searchParams.get("token") || undefined;
  if (!input || input.length < 3) {
    return NextResponse.json({ predictions: [] });
  }

  try {
    const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_KEY,
      },
      cache: "no-store",
      body: JSON.stringify({
        input,
        languageCode: "el",
        regionCode: "GR",
        includedRegionCodes: ["gr"],
        ...(sessionToken ? { sessionToken } : {}),
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      return NextResponse.json({ error: "Google autocomplete failed", detail }, { status: 502 });
    }

    const data = await res.json();
    const predictions: PlacePrediction[] = (data.suggestions ?? [])
      .filter((s: any) => s.placePrediction)
      .map((s: any) => {
        const p = s.placePrediction;
        return {
          placeId: p.placeId,
          description: p.text?.text ?? "",
          mainText: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
          secondaryText: p.structuredFormat?.secondaryText?.text ?? "",
        };
      });

    return NextResponse.json({ predictions });
  } catch {
    return NextResponse.json({ error: "Network error" }, { status: 502 });
  }
}
