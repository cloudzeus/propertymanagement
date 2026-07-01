import "server-only";
import { db } from "@/lib/db";
import { pickLocale } from "@/lib/i18n/translatable";
import { getAllLandingSections } from "@/lib/cms/landing";
import type { Locale } from "@/i18n";

/** Join non-empty, trimmed parts and hard-truncate to max chars. */
export function summarizeContext(parts: string[], max: number): string {
  const text = parts.map((p) => p.trim()).filter(Boolean).join("\n");
  return text.length > max ? text.slice(0, max) : text;
}

const MAX = 1500;

export async function getPageContext(slug: string, locale: Locale): Promise<string> {
  if (slug === "home") {
    const sections = await getAllLandingSections();
    const parts = sections.flatMap((s) => {
      const d = pickLocale(s.data as any, locale) as any;
      return [d?.heading, d?.title, d?.subtitle, ...(Array.isArray(d?.items) ? d.items.map((i: any) => i?.title) : [])];
    });
    return summarizeContext(["Αρχική σελίδα — Orithon property management.", ...parts.map((p) => String(p ?? ""))], MAX);
  }
  if (slug === "pricing") {
    const tiers = await db.pricingTier.findMany({ orderBy: { order: "asc" } });
    return summarizeContext(["Σελίδα τιμών / πακέτα.", ...tiers.map((t) => `${t.name}: ${t.description ?? ""}`)], MAX);
  }
  if (slug === "faq") {
    const faqs = await db.fAQ.findMany({ orderBy: { order: "asc" }, take: 20 });
    return summarizeContext(["Συχνές ερωτήσεις.", ...faqs.map((f) => f.question)], MAX);
  }
  if (["services", "contact", "privacy", "terms", "cookie-policy"].includes(slug)) {
    const page = await db.cMSPage.findUnique({ where: { slug } });
    const i = (page?.i18n ?? {}) as any;
    const title = i?.title ? pickLocale(i.title, locale) : page?.title ?? slug;
    const body = i?.body ? pickLocale(i.body, locale) : page?.content ?? "";
    return summarizeContext([String(title), String(body)], MAX);
  }
  if (slug === "blog") {
    return summarizeContext(["Blog & άρθρα για διαχείριση κτηρίων, κοινόχρηστα και ακίνητα."], MAX);
  }
  return summarizeContext([`Σελίδα: ${slug} — Orithon property management, Αθήνα.`], MAX);
}
