import "server-only";
import { db } from "@/lib/db";
import { DEFAULT_CONSENT_CONFIG, type ConsentConfig } from "./site-settings-defaults";

export async function getSiteSettings() {
  const row = await db.siteSettings.findUnique({ where: { id: "singleton" } });
  const consentConfig = (row?.consentConfig as unknown as ConsentConfig | null) ?? DEFAULT_CONSENT_CONFIG;
  return {
    siteName: row?.siteName ?? "PropertyPro",
    defaultOgImage: row?.defaultOgImage ?? null,
    social: { facebook: row?.facebookUrl ?? null, instagram: row?.instagramUrl ?? null, linkedin: row?.linkedinUrl ?? null, x: row?.xUrl ?? null, youtube: row?.youtubeUrl ?? null, tiktok: row?.tiktokUrl ?? null },
    googleAnalyticsId: row?.googleAnalyticsId ?? null,
    googleTagManagerId: row?.googleTagManagerId ?? null,
    facebookPixelId: row?.facebookPixelId ?? null,
    extraHeadHtml: row?.extraHeadHtml ?? null,
    extraBodyHtml: row?.extraBodyHtml ?? null,
    googleSiteVerification: row?.googleSiteVerification ?? null,
    bingSiteVerification: row?.bingSiteVerification ?? null,
    geo: row?.geoLat != null && row?.geoLng != null ? { lat: row.geoLat, lng: row.geoLng } : null,
    address: { street: row?.addrStreet ?? null, city: row?.addrCity ?? null, postal: row?.addrPostal ?? null, country: row?.addrCountry ?? null },
    telephone: row?.telephone ?? null,
    openingHours: row?.openingHours ?? null,
    consentEnabled: row?.consentEnabled ?? true,
    consentConfig,
  };
}
export type SiteSettingsView = Awaited<ReturnType<typeof getSiteSettings>>;
