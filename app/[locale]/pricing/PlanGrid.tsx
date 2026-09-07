"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { formatEuro } from "@/lib/pricing/calculator";
import { Tick, btnClass } from "@/components/site/kit";

export interface PlanCard {
  id: string;
  name: string;
  description: string;
  /** € per apartment per month, at the monthly cycle. */
  monthlyPrice: number;
  minPerBuilding: number | null;
  features: string[];
  highlighted: boolean;
  badge: string | null;
  ctaLabel: string;
  ctaHref: string;
}

/**
 * Plan cards plus the billing toggle that drives them. The toggle multiplies
 * every displayed rate and minimum — it is the same ANNUAL_MULTIPLIER the cost
 * calculator uses, passed in so the two can never drift.
 */
export function PlanGrid({
  plans,
  monthlyLabel,
  annualLabel,
  priceUnit,
  minimumTemplate,
  annualMultiplier,
}: {
  plans: PlanCard[];
  monthlyLabel: string;
  annualLabel: string;
  priceUnit: string;
  /** "Minimum {value} per building / month" */
  minimumTemplate: string;
  annualMultiplier: number;
}) {
  const locale = useLocale() === "en" ? "en" : "el";
  const [annual, setAnnual] = useState(true);
  const factor = annual ? annualMultiplier : 1;

  return (
    <>
      <div className="mt-[34px] inline-flex gap-1.5 rounded-[12px] bg-[rgba(27,28,26,.05)] p-1">
        {[
          { on: !annual, label: monthlyLabel, set: () => setAnnual(false) },
          { on: annual, label: annualLabel, set: () => setAnnual(true) },
        ].map((seg) => (
          <button
            key={seg.label}
            type="button"
            onClick={seg.set}
            aria-pressed={seg.on}
            className={`rounded-[9px] px-5 py-[11px] text-[13.5px] transition-[background,box-shadow] duration-[180ms] ${
              seg.on
                ? "bg-white font-bold text-[var(--txt)] shadow-[var(--shadow-seg)]"
                : "font-semibold text-[var(--mut)]"
            }`}
          >
            {seg.label}
          </button>
        ))}
      </div>

      <div className="mt-[52px] grid items-start gap-[18px] lg:grid-cols-3">
        {plans.map((p) => (
          <div
            key={p.id}
            className="relative flex flex-col rounded-[22px] bg-white px-[30px] pb-[34px] pt-8"
            style={
              p.highlighted
                ? {
                    border: "1.5px solid var(--accent)",
                    boxShadow: "var(--shadow-amber)",
                    transform: "translateY(-8px)",
                  }
                : { border: "1px solid var(--line)", boxShadow: "var(--shadow-card)" }
            }
          >
            {p.highlighted && p.badge ? (
              <span className="u-caps absolute -top-3 left-[30px] rounded-full bg-[var(--accent)] px-3 py-1.5 text-[11px] font-extrabold tracking-[.09em] text-[#1b1c1a]">
                {p.badge}
              </span>
            ) : null}

            <h3 className="text-[20px] font-extrabold tracking-[-.01em]">{p.name}</h3>
            {/* min-height keeps the price line level across cards of different copy lengths */}
            <p className="mt-[7px] text-[13.5px] leading-[1.5] text-[var(--mut)]" style={{ minHeight: 40 }}>
              {p.description}
            </p>

            <div className="mb-1 mt-[22px] flex items-end gap-2">
              <span className="tnum text-[52px] font-extrabold leading-[.92] tracking-[-.035em]">
                {formatEuro(p.monthlyPrice * factor, locale, 2)}
              </span>
              <span className="pb-[5px] text-[12.5px] leading-[1.35] text-[var(--mut)]" style={{ maxWidth: 92 }}>
                {priceUnit}
              </span>
            </div>

            {p.minPerBuilding != null ? (
              <p className="tnum text-[12px] text-[var(--mut2)]">
                {minimumTemplate.replace("{value}", formatEuro(p.minPerBuilding * factor, locale, 0))}
              </p>
            ) : null}

            {p.features.length > 0 && (
              <ul className="mb-7 mt-[26px] flex flex-col gap-3">
                {p.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-[11px] text-[14px] leading-[1.5]">
                    <Tick />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            )}

            <Link
              href={p.ctaHref}
              className={btnClass(p.highlighted ? "primary" : "ghost", "md", "mt-auto w-full")}
            >
              {p.ctaLabel}
            </Link>
          </div>
        ))}
      </div>
    </>
  );
}
