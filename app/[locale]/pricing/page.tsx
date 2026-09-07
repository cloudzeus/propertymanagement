import { getLocale } from "next-intl/server";
import type { Locale } from "@/i18n";
import { getPricingTiers, localizedTier } from "@/lib/cms/pages";
import { getMarketingPage } from "@/lib/cms/marketing-pages.server";
import { getCalculatorSection } from "@/lib/cms/landing";
import { resolveCalculator } from "@/lib/pricing/resolve";
import { pickLocale } from "@/lib/i18n/translatable";
import { buildPageMetadata, SITE_BASE } from "@/lib/seo/page-metadata";
import { productOfferSchema, breadcrumbSchema } from "@/lib/seo/schema";
import { JsonLd } from "@/components/seo/JsonLd";
import { MarketingShell } from "@/components/site/MarketingShell";
import { BtnLink, Card, DarkPanel, Kicker, PageHeader, Wrap } from "@/components/site/kit";
import { PlanGrid, type PlanCard } from "./PlanGrid";

// Reads pricing tiers from the DB, so it must not be statically prerendered at
// build time (no database during the Docker build).
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return buildPageMetadata("pricing", locale as Locale, "/pricing");
}

const FALLBACK_CTA = { el: "Ξεκινήστε", en: "Get started" };
const FALLBACK_BADGE = { el: "ΔΗΜΟΦΙΛΕΣΤΕΡΟ", en: "Most popular" };

export default async function PricingPage() {
  const locale = (await getLocale()) as Locale;
  const lang = locale === "en" ? "en" : "el";

  const [tiers, content, calcRaw] = await Promise.all([
    getPricingTiers(),
    getMarketingPage("pricing", locale),
    getCalculatorSection(),
  ]);

  // The annual discount is owned by the calculator section — one source, so the
  // pricing toggle and the calculator can never disagree.
  const calc = resolveCalculator(calcRaw ? (pickLocale(calcRaw as any, locale) as any) : null);

  const plans: PlanCard[] = tiers.map((t) => {
    const lt = localizedTier(t, locale);
    return {
      id: t.id,
      name: lt.name,
      description: lt.description,
      monthlyPrice: t.monthlyPrice,
      minPerBuilding: t.minPerBuilding ?? null,
      features: lt.features ?? [],
      highlighted: t.highlighted,
      badge: lt.badge || FALLBACK_BADGE[lang],
      ctaLabel: lt.ctaLabel || FALLBACK_CTA[lang],
      ctaHref: t.ctaHref || "/contact",
    };
  });

  return (
    <MarketingShell>
      <PageHeader
        eyebrow={content.header.eyebrow}
        title={content.header.title}
        lead={content.header.lead}
      >
        {plans.length > 0 && (
          <PlanGrid
            plans={plans}
            monthlyLabel={content.billingMonthlyLabel}
            annualLabel={content.billingAnnualLabel}
            priceUnit={content.priceUnit}
            minimumTemplate={content.minimumTemplate}
            annualMultiplier={calc.annualMultiplier}
          />
        )}
      </PageHeader>

      {plans.length === 0 && (
        <Wrap className="py-16">
          <p className="text-[var(--mut)]">
            {lang === "el" ? "Δεν υπάρχουν διαθέσιμα πακέτα ακόμη." : "No pricing tiers available yet."}
          </p>
        </Wrap>
      )}

      {/* Enterprise strip */}
      <Wrap className="mt-[18px]">
        <Card radius={20} className="flex flex-wrap items-center justify-between gap-[30px] px-[34px] py-8">
          <div>
            <h3 className="text-[length:var(--fs-24)] font-extrabold tracking-[-.015em]">{content.enterprise.heading}</h3>
            <p className="mt-3 max-w-[620px] text-[length:var(--fs-15)] leading-[1.6] text-[var(--mut)]">
              {content.enterprise.body}
            </p>
          </div>
          <BtnLink href={content.enterprise.cta.href} variant="ghost">
            {content.enterprise.cta.label}
          </BtnLink>
        </Card>
      </Wrap>

      {/* All plans include */}
      <Wrap className="mt-14">
        <Kicker>{content.includedKicker}</Kicker>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {content.included.map((item) => (
            <div
              key={item.title}
              className="rounded-[14px] border border-[var(--line2)] bg-[var(--paper)] p-5"
            >
              <div className="mb-1.5 text-[length:var(--fs-14-5)] font-bold">{item.title}</div>
              <p className="text-[length:var(--fs-13)] leading-[1.5] text-[var(--mut)]">{item.body}</p>
            </div>
          ))}
        </div>
      </Wrap>

      {/* Comparison band */}
      <section className="mt-[88px] bg-[var(--section-alt)] py-[88px] lg:py-24">
        <Wrap>
          <Kicker>{content.comparison.kicker}</Kicker>
          <h2 className="mt-[14px] text-[length:var(--fs-32)] font-extrabold leading-[1.05] tracking-[-.02em] sm:text-[length:var(--fs-40)]">
            {content.comparison.heading}
          </h2>
          {/* Horizontal scroll rather than three-line cells (handoff 05 §5) */}
          <div className="mt-11 -mx-5 overflow-x-auto px-5 sm:-mx-7 sm:px-7">
            <table className="w-full min-w-[620px] border-collapse text-[length:var(--fs-13)] sm:text-[length:var(--fs-14-5)]">
              <thead>
                <tr>
                  <th className="u-caps border-b border-[var(--line)] px-2.5 py-3 text-left text-[length:var(--fs-12)] font-bold tracking-[.1em] text-[var(--mut2)] sm:px-[18px] sm:py-4">
                    &nbsp;
                  </th>
                  {content.comparison.columns.map((col) => (
                    <th
                      key={col}
                      className="u-caps w-[110px] border-b border-[var(--line)] px-2.5 py-3 text-center text-[length:var(--fs-12)] font-bold tracking-[.1em] text-[var(--mut2)] sm:w-[150px] sm:px-[18px] sm:py-4"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {content.comparison.rows.map((row) => (
                  <tr key={row.feature} className="transition-colors hover:bg-[rgba(255,255,255,.6)]">
                    <td className="border-b border-[var(--line2)] px-2.5 py-3 sm:px-[18px] sm:py-4">
                      {row.feature}
                    </td>
                    {[row.essential, row.standard, row.pro].map((cell, i) => (
                      <td
                        key={i}
                        className={`border-b border-[var(--line2)] px-2.5 py-3 text-center sm:px-[18px] sm:py-4 ${
                          cell === "✓"
                            ? "font-extrabold text-[var(--accent)]"
                            : cell === "—"
                              ? "text-[var(--mut2)]"
                              : ""
                        }`}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Wrap>
      </section>

      {/* Calculator cross-sell — same geometry as the enterprise strip, dark */}
      <Wrap className="py-[72px] pb-5">
        <DarkPanel radius={20} className="flex flex-wrap items-center justify-between gap-[30px] px-[34px] py-8">
          <div>
            <h3 className="text-[length:var(--fs-24)] font-extrabold tracking-[-.015em] text-white">
              {content.calculatorStrip.heading}
            </h3>
            <p className="mt-3 max-w-[560px] text-[length:var(--fs-15)] leading-[1.6] text-[rgba(255,255,255,.62)]">
              {content.calculatorStrip.body}
            </p>
          </div>
          <BtnLink href={content.calculatorStrip.cta.href} variant="amber">
            {content.calculatorStrip.cta.label}
          </BtnLink>
        </DarkPanel>
      </Wrap>

      <JsonLd
        data={[
          ...tiers.map((t) => {
            const lt = localizedTier(t, locale);
            return productOfferSchema({
              name: lt.name,
              description: lt.description,
              price: t.monthlyPrice,
              url: `${SITE_BASE}/contact`,
            });
          }),
          breadcrumbSchema([
            { name: "Home", url: SITE_BASE },
            { name: content.header.eyebrow, url: `${SITE_BASE}/pricing` },
          ]),
        ]}
      />
    </MarketingShell>
  );
}
