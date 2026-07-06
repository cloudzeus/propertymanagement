import { requirePermission } from "@/lib/rbac/permissions";
import { db } from "@/lib/db";
import { DEFAULT_CONSENT_CONFIG, type ConsentConfig } from "@/lib/cms/site-settings-defaults";
import { SettingsForm } from "./SettingsForm";

const s = (v: string | null | undefined) => v ?? "";
const n = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v));

export default async function SiteSettingsPage() {
  await requirePermission("cms-settings", "view");
  const row = await db.siteSettings.findUnique({ where: { id: "singleton" } });

  const initial = {
    siteName: s(row?.siteName),
    defaultOgImage: s(row?.defaultOgImage),
    facebookUrl: s(row?.facebookUrl),
    instagramUrl: s(row?.instagramUrl),
    linkedinUrl: s(row?.linkedinUrl),
    xUrl: s(row?.xUrl),
    youtubeUrl: s(row?.youtubeUrl),
    tiktokUrl: s(row?.tiktokUrl),
    googleAnalyticsId: s(row?.googleAnalyticsId),
    googleTagManagerId: s(row?.googleTagManagerId),
    facebookPixelId: s(row?.facebookPixelId),
    extraHeadHtml: s(row?.extraHeadHtml),
    extraBodyHtml: s(row?.extraBodyHtml),
    googleSiteVerification: s(row?.googleSiteVerification),
    bingSiteVerification: s(row?.bingSiteVerification),
    geoLat: n(row?.geoLat),
    geoLng: n(row?.geoLng),
    addrStreet: s(row?.addrStreet),
    addrCity: s(row?.addrCity),
    addrPostal: s(row?.addrPostal),
    addrCountry: s(row?.addrCountry),
    telephone: s(row?.telephone),
    openingHours: s(row?.openingHours),
    consentEnabled: row?.consentEnabled ?? true,
    consentConfig: ((row?.consentConfig as ConsentConfig | null) ?? DEFAULT_CONSENT_CONFIG),
  };

  return (
    <div style={{ padding: 32 }}>
      <SettingsForm initial={initial} />
    </div>
  );
}
