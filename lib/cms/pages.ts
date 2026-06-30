import "server-only";
import { db } from "@/lib/db";
import { pickLocale } from "@/lib/i18n/translatable";
import type { Locale } from "@/i18n";

export function localizedCmsPage(row: { title: string; content: string; i18n: any }, locale: Locale) {
  const i = row.i18n;
  return { title: i?.title ? pickLocale(i.title, locale) : row.title, body: i?.body ? pickLocale(i.body, locale) : row.content };
}
export async function getCmsPage(slug: string) { return db.cMSPage.findUnique({ where: { slug } }); }
export async function getPricingTiers() { return db.pricingTier.findMany({ where: { published: true }, orderBy: { order: "asc" } }); }
export function localizedTier(t: any, locale: Locale) {
  const i = t.i18n;
  return {
    name: i?.name ? pickLocale(i.name, locale) : t.name,
    description: i?.description ? pickLocale(i.description, locale) : (t.description ?? ""),
    features: i?.features ? pickLocale(i.features, locale) : (t.features ?? []),
  };
}
export async function getFaqs() { return db.fAQ.findMany({ where: { published: true }, orderBy: { order: "asc" } }); }
export function localizedFaq(f: any, locale: Locale) {
  const i = f.i18n;
  return { question: i?.question ? pickLocale(i.question, locale) : f.question, answer: i?.answer ? pickLocale(i.answer, locale) : f.answer };
}
