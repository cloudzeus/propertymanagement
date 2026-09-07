import "server-only";
import { db } from "@/lib/db";
import type { Locale } from "@/i18n";
import {
  MARKETING_PAGE_DEFAULTS,
  MARKETING_PAGE_SLUGS,
  withDefaults,
  type MarketingPageSlug,
} from "./marketing-pages";

/**
 * Reads one marketing page's content for a locale, falling back to the handoff
 * defaults. A DB failure must never take the public page down — an unreachable
 * database degrades to the built-in copy rather than a 500.
 */
export async function getMarketingPage<S extends MarketingPageSlug>(
  slug: S,
  locale: Locale,
): Promise<(typeof MARKETING_PAGE_DEFAULTS)[S]["el"]> {
  const lang = locale === "en" ? "en" : "el";
  try {
    const row = await db.marketingPage.findUnique({ where: { slug } });
    return withDefaults(slug, row?.data, lang);
  } catch {
    return MARKETING_PAGE_DEFAULTS[slug][lang];
  }
}

/** Raw bilingual blob for the editor. */
export async function getMarketingPageRaw(slug: MarketingPageSlug) {
  const row = await db.marketingPage.findUnique({ where: { slug } });
  return row?.data ?? MARKETING_PAGE_DEFAULTS[slug];
}

/** Creates rows for any page missing from the DB so the admin list is complete. */
export async function ensureMarketingPages(): Promise<void> {
  const existing = await db.marketingPage.findMany({ select: { slug: true } });
  const have = new Set(existing.map((r) => r.slug));
  for (const slug of MARKETING_PAGE_SLUGS) {
    if (have.has(slug)) continue;
    await db.marketingPage.create({
      data: { slug, data: MARKETING_PAGE_DEFAULTS[slug] as object },
    });
  }
}
