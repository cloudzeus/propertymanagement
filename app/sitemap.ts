import type { MetadataRoute } from "next";
import { locales, defaultLocale } from "@/i18n";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://property.dgsmart.gr";
const PATHS = ["/", "/pricing", "/services", "/blog", "/faq", "/contact", "/privacy", "/terms", "/cookie-policy"];

function loc(locale: string, path: string) {
  if (locale === defaultLocale) return `${BASE}${path === "/" ? "" : path}`;
  return `${BASE}/${locale}${path === "/" ? "" : path}`;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = PATHS.map((p) => ({
    url: loc(defaultLocale, p),
    alternates: { languages: Object.fromEntries(locales.map((l) => [l, loc(l, p)])) },
  }));

  try {
    const { publishedArticleSlugs } = await import("@/lib/cms/blog");
    const slugs = await publishedArticleSlugs();
    for (const { slug } of slugs) {
      const p = `/blog/${slug}`;
      entries.push({
        url: loc(defaultLocale, p),
        alternates: { languages: Object.fromEntries(locales.map((l) => [l, loc(l, p)])) },
      });
    }
  } catch {
    // Missing DB at build time must not break the sitemap.
  }

  return entries;
}
