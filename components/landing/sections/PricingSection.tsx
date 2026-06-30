import Link from "next/link";
import { db } from "@/lib/db";
import type { PricingData } from "@/lib/cms/landing-types";

export async function PricingSection({ data }: { data: PricingData }) {
  const tiers = await db.pricingTier.findMany({
    where: { published: true },
    orderBy: { order: "asc" },
  });

  return (
    <section className="bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-14">
          {data.heading && (
            <h2 className="text-3xl font-bold tracking-tight text-gray-900">{data.heading}</h2>
          )}
          {data.subtitle && (
            <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">{data.subtitle}</p>
          )}
        </div>

        {tiers.length === 0 ? (
          <p className="text-center text-gray-600">No pricing tiers available yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
            {tiers.map((tier) => (
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
                    ΔΗΜΟΦΙΛΕΣΤΕΡΟ
                  </div>
                )}
                <div className="p-8">
                  <h3 className="text-xl font-bold text-gray-900">{tier.name}</h3>
                  {tier.description && (
                    <p className="mt-2 text-sm text-gray-600">{tier.description}</p>
                  )}

                  <div className="mt-6">
                    {tier.monthlyPrice !== null ? (
                      <p className="text-4xl font-bold text-gray-900">
                        €{tier.monthlyPrice}
                        <span className="text-base font-normal text-gray-500"> /μήνα</span>
                      </p>
                    ) : (
                      <p className="text-4xl font-bold text-gray-900">Custom</p>
                    )}
                  </div>

                  <Link
                    href={tier.slug === "enterprise" ? "/contact" : "/register"}
                    className={`mt-6 block w-full text-center py-3 rounded-lg text-sm font-semibold transition ${
                      tier.highlighted ? "text-white hover:opacity-90" : "border hover:bg-gray-50"
                    }`}
                    style={
                      tier.highlighted
                        ? { background: "var(--color-primary)" }
                        : { borderColor: "var(--color-primary)", color: "var(--color-primary)" }
                    }
                  >
                    {tier.slug === "enterprise" ? "Επικοινωνία" : "Ξεκινήστε"}
                  </Link>

                  {tier.features && tier.features.length > 0 && (
                    <ul className="mt-8 space-y-3">
                      {tier.features.map((feature, index) => (
                        <li key={index} className="flex items-start gap-3 text-sm text-gray-700">
                          <span style={{ color: "var(--color-success)" }} className="mt-0.5">✓</span>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
