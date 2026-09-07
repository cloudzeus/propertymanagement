import "server-only";
import { getAppSettings } from "@/lib/app-settings";
import { DEFAULT_EMAIL_BRAND, type EmailBrand } from "@/lib/email-template";

let cache: { at: number; brand: EmailBrand } | null = null;

/** Brand block for emails from AppSettings (logo/name/contact), cached 5 min. Falls back to the Orithon defaults. */
export async function getEmailBrand(): Promise<EmailBrand> {
  if (cache && Date.now() - cache.at < 5 * 60_000) return cache.brand;
  try {
    const s = await getAppSettings();
    const logo = s.logoFullLight ?? s.logoUrl;
    const brand: EmailBrand = {
      name: s.companyName && s.companyName !== "PropertyPro" ? s.companyName : DEFAULT_EMAIL_BRAND.name,
      logoUrl: logo && /^https?:\/\//.test(logo) ? logo : DEFAULT_EMAIL_BRAND.logoUrl,
      siteUrl: s.websiteUrl && /^https?:\/\//.test(s.websiteUrl) ? s.websiteUrl : DEFAULT_EMAIL_BRAND.siteUrl,
      address: s.contactAddress ?? DEFAULT_EMAIL_BRAND.address,
      phone: s.contactPhone,
      email: s.contactEmail,
    };
    cache = { at: Date.now(), brand };
    return brand;
  } catch {
    return DEFAULT_EMAIL_BRAND;
  }
}
