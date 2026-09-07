import { getLocale } from "next-intl/server";
import type { Locale } from "@/i18n";
import { getFaqs, localizedFaq } from "@/lib/cms/pages";
import { getMarketingPage } from "@/lib/cms/marketing-pages.server";
import { buildPageMetadata, SITE_BASE } from "@/lib/seo/page-metadata";
import { faqPageSchema, breadcrumbSchema } from "@/lib/seo/schema";
import { JsonLd } from "@/components/seo/JsonLd";
import { MarketingShell } from "@/components/site/MarketingShell";
import { BtnLink, Card, PageHeader, Wrap } from "@/components/site/kit";
import { FaqBrowser, type FaqCategory } from "./FaqBrowser";

// Reads FAQ rows from the DB, so it must not be statically prerendered at
// build time (no database during the Docker build).
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return buildPageMetadata("faq", locale as Locale, "/faq");
}

export default async function FAQPage() {
  const locale = (await getLocale()) as Locale;
  const lang = locale === "en" ? "en" : "el";
  const [faqs, content] = await Promise.all([getFaqs(), getMarketingPage("faq", locale)]);

  const localizedItems = faqs.map((f) => localizedFaq(f, locale));

  // Group by DB category, then order by the CMS sidebar list. Categories that
  // exist in the data but not in the sidebar still show, labelled by their slug
  // — a question must never be unreachable because someone renamed a category.
  const grouped = new Map<string, FaqCategory["items"]>();
  faqs.forEach((f) => {
    const key = (f.category as string) ?? "general";
    const item = localizedFaq(f, locale);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push({ id: f.id, ...item });
  });

  const ordered: FaqCategory[] = [];
  for (const c of content.categories) {
    const items = grouped.get(c.slug);
    if (items?.length) {
      ordered.push({ slug: c.slug, label: c.label, items });
      grouped.delete(c.slug);
    }
  }
  for (const [slug, items] of grouped) {
    ordered.push({ slug, label: slug, items });
  }

  return (
    <MarketingShell>
      <PageHeader
        eyebrow={content.header.eyebrow}
        title={content.header.title}
        lead={content.header.lead}
        titleMaxWidth={700}
      />

      <Wrap className="pb-4">
        {ordered.length === 0 ? (
          <p className="mt-12 text-[var(--mut)]">
            {lang === "el" ? "Δεν υπάρχουν ερωτήσεις ακόμη." : "No questions available yet."}
          </p>
        ) : (
          <FaqBrowser categories={ordered} />
        )}

        <Card radius={20} className="mt-11 flex flex-wrap items-center justify-between gap-[30px] px-10 py-9">
          <div>
            <h3 className="text-[length:var(--fs-24)] font-extrabold tracking-[-.015em]">{content.help.heading}</h3>
            <p className="mt-3 max-w-[480px] text-[length:var(--fs-15)] leading-[1.6] text-[var(--mut)]">{content.help.body}</p>
          </div>
          <BtnLink href={content.help.cta.href}>{content.help.cta.label}</BtnLink>
        </Card>
      </Wrap>

      <JsonLd
        data={[
          faqPageSchema(localizedItems),
          breadcrumbSchema([
            { name: "Home", url: SITE_BASE },
            { name: content.header.eyebrow, url: `${SITE_BASE}/faq` },
          ]),
        ]}
      />
    </MarketingShell>
  );
}
