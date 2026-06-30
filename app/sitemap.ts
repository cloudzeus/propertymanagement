import type { MetadataRoute } from "next";
import { locales, defaultLocale } from "@/i18n";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://property.dgsmart.gr";
const PATHS = ["/", "/pricing", "/faq", "/contact", "/privacy", "/terms", "/cookie-policy"];

function loc(locale: string, path: string) {
  if (locale === defaultLocale) return `${BASE}${path === "/" ? "" : path}`;
  return `${BASE}/${locale}${path === "/" ? "" : path}`;
}

export default function sitemap(): MetadataRoute.Sitemap {
  return PATHS.map((p) => ({
    url: loc(defaultLocale, p),
    alternates: { languages: Object.fromEntries(locales.map((l) => [l, loc(l, p)])) },
  }));
}
