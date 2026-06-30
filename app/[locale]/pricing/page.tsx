import Link from "next/link";
import { getLocale } from "next-intl/server";
import { RiCheckLine } from "react-icons/ri";
import type { Locale } from "@/i18n";
import { getPricingTiers, localizedTier } from "@/lib/cms/pages";
import { buildPageMetadata, SITE_BASE } from "@/lib/seo/page-metadata";
import { productOfferSchema, breadcrumbSchema } from "@/lib/seo/schema";
import { JsonLd } from "@/components/seo/JsonLd";
import { LandingHeader } from "@/components/landing/landing-header";
import { LandingFooter } from "@/components/landing/landing-footer";

// Reads pricing tiers from the DB, so it must not be statically prerendered at
// build time (no database during the Docker build).
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return buildPageMetadata("pricing", locale as Locale, "/pricing");
}

export default async function PricingPage() {
  const locale = (await getLocale()) as Locale;
  const tiers = await getPricingTiers();

  const heading = locale === "el" ? "Τιμές" : "Pricing";
  const subtitle =
    locale === "el"
      ? "Διαφανής τιμολόγηση. Χωρίς κρυφές χρεώσεις, χωρίς δεσμεύσεις."
      : "Transparent pricing. No hidden fees, no long-term contracts.";

  return (
    <div className="min-h-screen bg-white">
      <LandingHeader />
      <main>
        <section className="bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
            <div className="text-center mb-14">
              <h1 className="text-3xl font-bold tracking-tight text-gray-900">{heading}</h1>
              <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">{subtitle}</p>
            </div>

            {tiers.length === 0 ? (
              <p className="text-center text-gray-600">
                {locale === "el" ? "Δεν υπάρχουν διαθέσιμα πακέτα ακόμη." : "No pricing tiers available yet."}
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
                {tiers.map((tier) => {
                  const lt = localizedTier(tier, locale);
                  return (
                    <div
                      key={tier.id}
                      className={`rounded-xl bg-white overflow-hidden ${
                        tier.highlighted
                          ? "border-2 shadow-lg md:scale-105"
                          : "border border-gray-200 shadow-sm"
                      }`}
                      style={tier.highlighted ? { borderColor: "var(--color-primary)" } : undefined}
                    >
                      {tier.highlighted && (
                        <div
                          className="py-2 text-center text-xs font-semibold text-white tracking-wide"
                          style={{ background: "var(--color-primary)" }}
                        >
                          {locale === "el" ? "ΔΗΜΟΦΙΛΕΣΤΕΡΟ" : "MOST POPULAR"}
                        </div>
                      )}
                      <div className="p-8">
                        <h3 className="text-xl font-bold text-gray-900">{lt.name}</h3>
                        {lt.description && <p className="mt-2 text-sm text-gray-600">{lt.description}</p>}

                        <div className="mt-6">
                          {tier.monthlyPrice > 0 ? (
                            <p className="text-4xl font-bold text-gray-900">
                              €{tier.monthlyPrice}
                              <span className="text-base font-normal text-gray-500"> /μήνα</span>
                            </p>
                          ) : (
                            <p className="text-4xl font-bold text-gray-900">
                              {locale === "el" ? "Κατόπιν επικοινωνίας" : "Contact us"}
                            </p>
                          )}
                        </div>

                        <Link
                          href="/register"
                          className={`mt-6 block w-full text-center py-3 rounded-lg text-sm font-semibold transition ${
                            tier.highlighted ? "text-white hover:opacity-90" : "border hover:bg-gray-50"
                          }`}
                          style={
                            tier.highlighted
                              ? { background: "var(--color-primary)" }
                              : { borderColor: "var(--color-primary)", color: "var(--color-primary)" }
                          }
                        >
                          {locale === "el" ? "Ξεκινήστε" : "Get started"}
                        </Link>

                        {lt.features && lt.features.length > 0 && (
                          <ul className="mt-8 space-y-3">
                            {lt.features.map((feature: string, index: number) => (
                              <li key={index} className="flex items-start gap-3 text-sm text-gray-700">
                                <RiCheckLine
                                  className="mt-0.5 shrink-0 w-4 h-4"
                                  style={{ color: "var(--color-success)" }}
                                />
                                <span>{feature}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <JsonLd
          data={[
            ...tiers.map((t) => {
              const lt = localizedTier(t, locale);
              return productOfferSchema({
                name: lt.name,
                description: lt.description,
                price: t.monthlyPrice,
                url: `${SITE_BASE}/register`,
              });
            }),
            breadcrumbSchema([
              { name: "Home", url: SITE_BASE },
              { name: "Pricing", url: `${SITE_BASE}/pricing` },
            ]),
          ]}
        />
      </main>
      <LandingFooter />
    </div>
  );
}
