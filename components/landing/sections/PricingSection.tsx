import Link from "next/link";
import { RiCheckLine } from "react-icons/ri";
import { db } from "@/lib/db";
import type { PricingData } from "@/lib/cms/landing-types";

export async function PricingSection({ data }: { data: PricingData }) {
  const tiers = await db.pricingTier.findMany({
    where: { published: true },
    orderBy: { order: "asc" },
  });

  return (
    <section>
      <div className="mx-auto max-w-[1200px] px-5 sm:px-7 py-[84px]">
        <div className="text-center mb-14">
          {data.heading && (
            <h2 className="text-[32px] md:text-[46px] font-extrabold tracking-[-0.02em] text-[var(--foreground)]">{data.heading}</h2>
          )}
          {data.subtitle && (
            <p className="mt-4 text-[19px] text-[var(--muted-foreground)] max-w-2xl mx-auto">{data.subtitle}</p>
          )}
        </div>

        {tiers.length === 0 ? (
          <p className="text-center text-[var(--muted-foreground)]">No pricing tiers available yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
            {tiers.map((tier) => (
              <div
                key={tier.id}
                className={`rounded-[var(--radius-lg)] bg-[var(--card)] overflow-hidden shadow-[var(--shadow-card)] ${
                  tier.highlighted
                    ? "border-2 shadow-lg md:scale-105"
                    : "border shadow-[var(--shadow-card)]"
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
                  <h3 className="text-xl font-bold text-[var(--foreground)]">{tier.name}</h3>
                  {tier.description && (
                    <p className="mt-2 text-sm text-[var(--muted-foreground)]">{tier.description}</p>
                  )}

                  <div className="mt-6">
                    {tier.monthlyPrice > 0 ? (
                      <p className="text-4xl font-extrabold text-[var(--foreground)]">
                        €{tier.monthlyPrice}
                        <span className="text-base font-normal text-[var(--muted-foreground)]"> /μήνα</span>
                      </p>
                    ) : (
                      <p className="text-4xl font-extrabold text-[var(--foreground)]">Κατόπιν επικοινωνίας</p>
                    )}
                  </div>

                  <Link
                    href={tier.slug === "enterprise" ? "/contact" : "/register"}
                    className={`mt-6 block w-full text-center py-3 rounded-[var(--radius-sm)] text-sm font-semibold transition ${
                      tier.highlighted ? "text-white hover:opacity-90" : "border hover:bg-[var(--paper)]"
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
                        <li key={index} className="flex items-start gap-3 text-sm text-[var(--foreground)]">
                          <RiCheckLine className="mt-0.5 shrink-0 w-4 h-4" style={{ color: "var(--color-success)" }} />
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
