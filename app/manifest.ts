import type { MetadataRoute } from "next";
import { getAppSettings } from "@/lib/app-settings";
import { buildManifest } from "@/lib/pwa/manifest";

// Διαβάζει τη βάση (AppSettings) → δεν μπορεί να τρέξει στο build (χωρίς DB).
export const dynamic = "force-dynamic";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const settings = await getAppSettings();
  return buildManifest({ companyName: settings.companyName });
}
