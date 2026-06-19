import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { geocodeAddress, reverseGeocode } from "@/lib/geocoding";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const address = searchParams.get("address");
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");

  if (address) {
    const results = await geocodeAddress(address);
    return NextResponse.json({ results });
  }

  if (lat && lng) {
    const displayName = await reverseGeocode(parseFloat(lat), parseFloat(lng));
    return NextResponse.json({ displayName });
  }

  return NextResponse.json({ error: "Provide address or lat+lng" }, { status: 400 });
}
