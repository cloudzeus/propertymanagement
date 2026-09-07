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
  // The scalar column holds the Greek value; i18n holds both. An empty string in
  // the requested locale falls back to the column rather than rendering blank.
  const pick = (key: string, fallback: string) => {
    const v = i?.[key] ? pickLocale(i[key], locale) : "";
    return (typeof v === "string" && v.trim()) || fallback;
  };
  return {
    name: pick("name", t.name),
    description: pick("description", t.description ?? ""),
    features: i?.features ? pickLocale(i.features, locale) : (t.features ?? []),
    badge: pick("badge", t.badge ?? ""),
    ctaLabel: pick("ctaLabel", t.ctaLabel ?? ""),
  };
}
export async function getFaqs() { return db.fAQ.findMany({ where: { published: true }, orderBy: { order: "asc" } }); }
export function localizedFaq(f: any, locale: Locale) {
  const i = f.i18n;
  return { question: i?.question ? pickLocale(i.question, locale) : f.question, answer: i?.answer ? pickLocale(i.answer, locale) : f.answer };
}
