import "server-only";
import { getPageSeo } from "@/lib/cms/page-seo";
import { getSiteSettings } from "@/lib/cms/site-settings";
import { buildMetadata } from "@/lib/seo/metadata";
import { pickLocale } from "@/lib/i18n/translatable";
import type { Locale } from "@/i18n";

export const SITE_BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://property.dgsmart.gr";

export async function buildPageMetadata(slug: string, locale: Locale, path: string) {
  const [t, site] = await Promise.all([getPageSeo(slug), getSiteSettings()]);
  const seo = t ? pickLocale(t, locale) : { title: "PropertyPro", description: "" };
  return buildMetadata({ seo, locale, path, baseUrl: SITE_BASE, defaultOgImage: site.defaultOgImage ?? undefined });
}
