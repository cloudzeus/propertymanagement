import { db } from '@/lib/db';
import Link from 'next/link';

// Reads pricing tiers from the DB, so it must not be statically prerendered at
// build time (no database during the Docker build).
export const dynamic = 'force-dynamic';

export default async function PricingPage() {
  // Fetch published pricing tiers ordered by display order
  const tiers = await db.pricingTier.findMany({
    where: { published: true },
    orderBy: { order: 'asc' },
  });

  return (
    <div>
      {/* Header */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-5xl font-bold mb-4">Simple, Transparent Pricing</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Pay only for what you use. No hidden fees, no long-term contracts. Cancel anytime.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {tiers.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600 text-lg">No pricing tiers available yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {tiers.map((tier) => (
                <div
                  key={tier.id}
                  className={`rounded-lg overflow-hidden transition transform hover:scale-105 ${
                    tier.highlighted
                      ? 'md:col-span-1 md:scale-105 border-2 border-blue-600 shadow-lg'
                      : 'border border-gray-200'
                  } bg-white`}
                >
                  {tier.highlighted && (
                    <div className="bg-blue-600 text-white py-2 text-center text-sm font-semibold">
                      MOST POPULAR
                    </div>
                  )}

                  <div className="p-8">
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">{tier.name}</h3>
                    {tier.description && (
                      <p className="text-gray-600 text-sm mb-6">{tier.description}</p>
                    )}

                    {tier.monthlyPrice !== null ? (
                      <div className="mb-6">
                        <p className="text-4xl font-bold text-gray-900">
                          €{tier.monthlyPrice}
                        </p>
                        <p className="text-gray-600 text-sm">
                          per unit per month (billed monthly)
                        </p>
                        {tier.annualPrice && (
                          <p className="text-gray-600 text-sm mt-1">
                            or €{Math.round(tier.annualPrice / 12)} per month billed annually
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="mb-6">
                        <p className="text-4xl font-bold text-gray-900">Custom</p>
                        <p className="text-gray-600 text-sm">Contact our sales team for pricing</p>
                      </div>
                    )}

                    <Link
                      href={tier.slug === 'enterprise' ? '/contact' : '/register'}
                      className={`w-full block text-center py-3 rounded-lg font-semibold transition ${
                        tier.highlighted
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'border border-blue-600 text-blue-600 hover:bg-blue-50'
                      }`}
                    >
                      {tier.slug === 'enterprise' ? 'Contact Sales' : 'Start Free Trial'}
                    </Link>

                    {tier.features && tier.features.length > 0 && (
                      <div className="mt-8">
                        <h4 className="font-semibold text-gray-900 mb-4">What's included:</h4>
                        <ul className="space-y-3">
                          {tier.features.map((feature, index) => (
                            <li key={index} className="flex items-center gap-3 text-sm text-gray-700">
                              <span className="text-green-500">✓</span>
                              {feature}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-blue-600 text-white py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold mb-4">Ready to get started?</h2>
          <p className="text-xl text-blue-100 mb-8">
            Choose a plan and start your 14-day free trial today. No credit card required.
          </p>
          <Link
            href="/register"
            className="inline-block px-8 py-3 bg-white text-blue-600 rounded-lg font-semibold hover:bg-gray-100"
          >
            Start Free Trial
          </Link>
        </div>
      </section>
    </div>
  );
}
