import { organizationSchema, webSiteSchema, localBusinessSchema } from "./schema";
import type { SiteSettingsView } from "@/lib/cms/site-settings";

export function buildSiteSchemas(s: SiteSettingsView, baseUrl: string, logo?: string) {
  const sameAs = Object.values(s.social).filter((v): v is string => !!v);
  const out: object[] = [
    organizationSchema({ name: s.siteName, url: baseUrl, ...(logo ? { logo } : {}), ...(sameAs.length ? { sameAs } : {}) }),
    webSiteSchema({ name: s.siteName, url: baseUrl }),
  ];
  if (s.geo && (s.address.city || s.address.street)) {
    out.push(localBusinessSchema({
      name: s.siteName, url: baseUrl, ...(s.telephone ? { telephone: s.telephone } : {}),
      address: { streetAddress: s.address.street ?? undefined, addressLocality: s.address.city ?? undefined, postalCode: s.address.postal ?? undefined, addressCountry: s.address.country ?? undefined },
      geo: s.geo, ...(sameAs.length ? { sameAs } : {}),
    }));
  }
  return out;
}
