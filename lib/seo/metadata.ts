import type { Metadata } from "next";
import type { SeoMeta } from "./types";
import { locales, defaultLocale, type Locale } from "@/i18n";

function localizedPath(locale: Locale, path: string): string {
  if (locale === defaultLocale) return path === "/" ? "" : path;
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}

export function buildMetadata(input: { seo: SeoMeta; locale: Locale; path: string; baseUrl: string; defaultOgImage?: string }): Metadata {
  const { seo, locale, path, baseUrl } = input;
  const ogImage = seo.ogImage || input.defaultOgImage;
  const canonical = `${baseUrl}${localizedPath(locale, path)}`;
  const languages: Record<string, string> = {};
  for (const l of locales) languages[l] = `${baseUrl}${localizedPath(l, path)}`;
  languages["x-default"] = `${baseUrl}${localizedPath(defaultLocale, path)}`;

  return {
    title: seo.title,
    description: seo.description,
    ...(seo.keywords ? { keywords: seo.keywords } : {}),
    alternates: { canonical, languages },
    openGraph: {
      title: seo.title, description: seo.description, url: canonical, siteName: "PropertyPro",
      locale, type: "website", ...(ogImage ? { images: [{ url: ogImage }] } : {}),
    },
    twitter: { card: "summary_large_image", title: seo.title, description: seo.description, ...(ogImage ? { images: [ogImage] } : {}) },
    ...(seo.robots ? { robots: seo.robots } : {}),
  };
}
