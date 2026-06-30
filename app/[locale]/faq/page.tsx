import { getLocale } from "next-intl/server";
import type { Locale } from "@/i18n";
import { getFaqs, localizedFaq } from "@/lib/cms/pages";
import { buildPageMetadata, SITE_BASE } from "@/lib/seo/page-metadata";
import { faqPageSchema, breadcrumbSchema } from "@/lib/seo/schema";
import { JsonLd } from "@/components/seo/JsonLd";
import { LandingHeader } from "@/components/landing/landing-header";
import { LandingFooter } from "@/components/landing/landing-footer";
import { FaqAccordion } from "./FaqAccordion";

// Reads FAQ rows from the DB, so it must not be statically prerendered at
// build time (no database during the Docker build).
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return buildPageMetadata("faq", locale as Locale, "/faq");
}

export default async function FAQPage() {
  const locale = (await getLocale()) as Locale;
  const faqs = await getFaqs();

  const localizedItems = faqs.map((f) => localizedFaq(f, locale));

  const groupMap = new Map<string, { question: string; answer: string }[]>();
  faqs.forEach((f) => {
    const category = (f.category as string) ?? "general";
    const item = localizedFaq(f, locale);
    if (!groupMap.has(category)) groupMap.set(category, []);
    groupMap.get(category)!.push(item);
  });
  const groups = Array.from(groupMap, ([category, items]) => ({ category, items }));

  const heading = locale === "el" ? "Συχνές ερωτήσεις" : "FAQ";

  return (
    <div className="min-h-screen bg-white">
      <LandingHeader />
      <main>
        <section className="bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
            <div className="text-center mb-14">
              <h1 className="text-3xl font-bold tracking-tight text-gray-900">{heading}</h1>
            </div>

            {groups.length === 0 ? (
              <p className="text-center text-gray-600">
                {locale === "el" ? "Δεν υπάρχουν ερωτήσεις ακόμη." : "No questions available yet."}
              </p>
            ) : (
              <FaqAccordion groups={groups} />
            )}
          </div>
        </section>

        <JsonLd
          data={[
            faqPageSchema(localizedItems),
            breadcrumbSchema([
              { name: "Home", url: SITE_BASE },
              { name: "FAQ", url: `${SITE_BASE}/faq` },
            ]),
          ]}
        />
      </main>
      <LandingFooter />
    </div>
  );
}
