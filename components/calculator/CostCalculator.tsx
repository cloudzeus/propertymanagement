"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import {
  ADDONS,
  ANNUAL_MULTIPLIER,
  CALC_DEFAULTS,
  PLANS,
  SLIDER_LIMITS,
  calculate,
  formatEuro,
  sliderPercent,
  type Addon,
  type AddonKey,
  type Plan,
  type PlanKey,
} from "@/lib/pricing/calculator";
import { Card, DarkPanel, GlowBlob, Kicker, Wrap, btnClass } from "@/components/site/kit";

export interface CalculatorCopy {
  kicker?: string;
  heading?: string;
  lead?: string;
  primaryCta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  footnote?: string;
  /** Per-plan display copy, keyed by plan key. */
  planNames?: Partial<Record<PlanKey, string>>;
  planUnits?: Partial<Record<PlanKey, string>>;
  addonNames?: Partial<Record<AddonKey, string>>;
}

const T = {
  el: {
    kicker: "Κοστολόγιο",
    heading: "Πόσο θα κοστίσει ανά διαμέρισμα;",
    lead: "Χρεώνουμε ανά διαμέρισμα, ανά μήνα. Δείτε το κόστος για το δικό σας χαρτοφυλάκιο.",
    q1: "Πόσα κτήρια;",
    q1hint: "Όσα διαχειρίζεστε σήμερα",
    q2: "Διαμερίσματα ανά κτήριο",
    q2hint: "Μέσος όρος στο χαρτοφυλάκιο",
    q3: "Επιλέξτε πακέτο",
    q3hint: "Ανά διαμέρισμα, ανά μήνα",
    q4: "Πρόσθετα",
    q4hint: "Προαιρετικά — τα απενεργοποιείτε όποτε θέλετε",
    q5: "Χρέωση",
    q5hint: "Η ετήσια χρέωση εξοικονομεί 20%",
    buildings: (n: number) => `${n} ${n === 1 ? "κτήριο" : "κτήρια"}`,
    apts: (n: number) => `${n} διαμ.`,
    perAptUnit: "διαμ.",
    monthly: "Μηνιαία",
    annual: "Ετήσια",
    estimate: "Η εκτίμησή σας",
    perApartment: "ανά διαμέρισμα / μήνα",
    scope: (b: number, a: number) =>
      `${b} ${b === 1 ? "κτήριο" : "κτήρια"} · ${a} διαμερίσματα συνολικά`,
    rowPlan: "Πακέτο",
    rowAddons: "Πρόσθετα",
    rowBilling: "Χρέωση",
    minApplied: " (ισχύει το ελάχιστο ανά κτήριο)",
    annualValue: "Ετήσια · −20%",
    monthlyValue: "Μηνιαία",
    totalLabel: "Σύνολο ανά μήνα",
    perYear: "/ έτος",
    saveAnnual: (v: string) => `Εξοικονομείτε ${v} τον χρόνο με ετήσια χρέωση.`,
    saveSwitch: (v: string) => `Αλλάξτε σε ετήσια χρέωση και εξοικονομήστε ${v} τον χρόνο.`,
    primary: "Κλείσε demo",
    secondary: "Δείτε όλες τις τιμές",
    footnote: "Μόνο εκτίμηση. Χωρίς ΦΠΑ. Τελική προσφορά μετά από μια παρουσίαση 20 λεπτών.",
    planNames: { essential: "Essential", standard: "Standard", pro: "Pro" } as Record<PlanKey, string>,
    planUnits: {
      essential: "χρεώσεις + πληρωμές",
      standard: "+ αιτήματα, αρχεία, επικοινωνία",
      pro: "+ API, αναφορές, SSO",
    } as Record<PlanKey, string>,
    addonNames: {
      payments: "Ηλεκτρονικές πληρωμές",
      technician: "Εφαρμογή τεχνικού",
      accounting: "Λογιστική εξαγωγή",
    } as Record<AddonKey, string>,
  },
  en: {
    kicker: "Cost calculator",
    heading: "What will it cost per apartment?",
    lead: "We charge per apartment, per month. See what your portfolio costs.",
    q1: "How many buildings?",
    q1hint: "Everything you manage today",
    q2: "Apartments per building",
    q2hint: "Average across the portfolio",
    q3: "Choose a plan",
    q3hint: "Per apartment, per month",
    q4: "Add-ons",
    q4hint: "Optional — switch off any time",
    q5: "Billing",
    q5hint: "Annual billing saves 20%",
    buildings: (n: number) => `${n} ${n === 1 ? "building" : "buildings"}`,
    apts: (n: number) => `${n} apts`,
    perAptUnit: "apt",
    monthly: "Monthly",
    annual: "Annual",
    estimate: "Your estimate",
    perApartment: "per apartment / month",
    scope: (b: number, a: number) =>
      `${b} ${b === 1 ? "building" : "buildings"} · ${a} apartments in total`,
    rowPlan: "Plan",
    rowAddons: "Add-ons",
    rowBilling: "Billing",
    minApplied: " (min. per building applied)",
    annualValue: "Annual · −20%",
    monthlyValue: "Monthly",
    totalLabel: "Total per month",
    perYear: "/ year",
    saveAnnual: (v: string) => `You save ${v} per year with annual billing.`,
    saveSwitch: (v: string) => `Switch to annual billing and save ${v} per year.`,
    primary: "Book a demo",
    secondary: "See full pricing",
    footnote: "Estimate only. VAT excluded. Final quote after a 20-minute walkthrough.",
    planNames: { essential: "Essential", standard: "Standard", pro: "Pro" } as Record<PlanKey, string>,
    planUnits: {
      essential: "charges + payments",
      standard: "+ tickets, docs, comms",
      pro: "+ API, reporting, SSO",
    } as Record<PlanKey, string>,
    addonNames: {
      payments: "Online payments",
      technician: "Technician app",
      accounting: "Accounting export",
    } as Record<AddonKey, string>,
  },
};

function trackStyle(pct: number) {
  // Hard stop, no feather (01 §5.7).
  return { background: `linear-gradient(90deg, #F2A23C ${pct}%, rgba(27,28,26,.10) ${pct}%)` };
}

/** One slider row — the readout sits at the right of the row header. */
function SliderRow({
  question,
  hint,
  readout,
  value,
  min,
  max,
  step,
  scale,
  onChange,
  first,
}: {
  question: string;
  hint: string;
  readout: string;
  value: number;
  min: number;
  max: number;
  step: number;
  scale: [string, string, string];
  onChange: (v: number) => void;
  first?: boolean;
}) {
  const pct = sliderPercent(value, min, max);
  return (
    <div className={first ? "" : "border-t border-[var(--line2)] pt-[22px]"} style={{ paddingBottom: 22 }}>
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <div className="text-[15.5px] font-bold">{question}</div>
          <div className="mt-1 text-[12.5px] font-normal text-[var(--mut2)]">{hint}</div>
        </div>
        <div className="tnum whitespace-nowrap text-[22px] font-extrabold tracking-[-.02em]">{readout}</div>
      </div>
      <input
        type="range"
        className="range"
        aria-label={question}
        min={min}
        max={max}
        step={step}
        value={value}
        style={trackStyle(pct)}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="tnum mt-2 flex justify-between text-[11.5px] text-[var(--mut2)]">
        {scale.map((s, i) => (
          <span key={i}>{s}</span>
        ))}
      </div>
    </div>
  );
}

export function CostCalculator({
  copy,
  plans = PLANS,
  addons = ADDONS,
  annualMultiplier = ANNUAL_MULTIPLIER,
}: {
  copy?: CalculatorCopy;
  plans?: readonly Plan[];
  addons?: readonly Addon[];
  annualMultiplier?: number;
}) {
  const locale = useLocale() === "en" ? "en" : "el";
  const t = T[locale];

  const [buildings, setBuildings] = useState(CALC_DEFAULTS.buildings);
  const [apts, setApts] = useState(CALC_DEFAULTS.apartmentsPerBuilding);
  const [plan, setPlan] = useState<PlanKey>(CALC_DEFAULTS.plan);
  const [annual, setAnnual] = useState(CALC_DEFAULTS.annual);
  const [selected, setSelected] = useState<AddonKey[]>(CALC_DEFAULTS.addons);

  const r = useMemo(
    () =>
      calculate({
        buildings,
        apartmentsPerBuilding: apts,
        plan,
        annual,
        addons: selected,
        plans,
        addonRates: addons,
        annualMultiplier,
      }),
    [buildings, apts, plan, annual, selected, plans, addons, annualMultiplier],
  );

  const planName = (k: PlanKey) => copy?.planNames?.[k] || t.planNames[k];
  const planUnit = (k: PlanKey) => copy?.planUnits?.[k] || t.planUnits[k];
  const addonName = (k: AddonKey) => copy?.addonNames?.[k] || t.addonNames[k];

  const saving = formatEuro(r.yearlySaving, locale, 0);

  return (
    <section id="calc" className="relative overflow-hidden py-[88px] lg:py-[108px]">
      <GlowBlob variant="calc" />
      <Wrap className="relative">
        <div className="mb-12" style={{ maxWidth: 660 }}>
          <Kicker>{copy?.kicker || t.kicker}</Kicker>
          <h2 className="mt-[14px] text-[32px] font-extrabold leading-[1.05] tracking-[-.02em] sm:text-[40px] lg:text-[46px]">
            {copy?.heading || t.heading}
          </h2>
          <p className="mt-4 text-[17px] leading-[1.6] text-[var(--mut)]">{copy?.lead || t.lead}</p>
        </div>

        <div className="grid items-start gap-[26px] lg:grid-cols-[1.12fr_.88fr]">
          {/* ── Controls ─────────────────────────────────────────────── */}
          <Card className="px-6 py-7 sm:px-[34px] sm:py-8">
            <SliderRow
              first
              question={t.q1}
              hint={t.q1hint}
              readout={t.buildings(buildings)}
              value={buildings}
              min={SLIDER_LIMITS.buildings.min}
              max={SLIDER_LIMITS.buildings.max}
              step={SLIDER_LIMITS.buildings.step}
              scale={["1", "60", "120+"]}
              onChange={setBuildings}
            />
            <SliderRow
              question={t.q2}
              hint={t.q2hint}
              readout={t.apts(apts)}
              value={apts}
              min={SLIDER_LIMITS.apartments.min}
              max={SLIDER_LIMITS.apartments.max}
              step={SLIDER_LIMITS.apartments.step}
              scale={["2", "40", "80"]}
              onChange={setApts}
            />

            {/* Plans */}
            <div className="border-t border-[var(--line2)] py-[22px]">
              <div className="mb-4">
                <div className="text-[15.5px] font-bold">{t.q3}</div>
                <div className="mt-1 text-[12.5px] text-[var(--mut2)]">{t.q3hint}</div>
              </div>
              <div className="grid gap-[10px] sm:grid-cols-3" role="radiogroup" aria-label={t.q3}>
                {plans.map((p) => {
                  const on = p.key === plan;
                  return (
                    <button
                      key={p.key}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setPlan(p.key)}
                      className="rounded-[14px] px-[15px] pb-[14px] pt-[15px] text-left transition-[transform,box-shadow,background,border-color] duration-[180ms]"
                      style={{
                        /* 1.5px in both states so selection never shifts layout */
                        border: `1.5px solid ${on ? "var(--accent)" : "var(--line2)"}`,
                        background: on ? "#fff" : "var(--paper)",
                        boxShadow: on ? "var(--shadow-amber-sm)" : "none",
                      }}
                    >
                      <div className="text-[14.5px] font-bold">{planName(p.key)}</div>
                      <div className="tnum mt-[9px] text-[19px] font-extrabold tracking-[-.02em]">
                        {formatEuro(p.rate, locale, 2)}
                      </div>
                      <div className="mt-1 text-[10.5px] leading-[1.35] text-[var(--mut2)]">
                        {planUnit(p.key)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Add-ons */}
            <div className="border-t border-[var(--line2)] py-[22px]">
              <div className="mb-4">
                <div className="text-[15.5px] font-bold">{t.q4}</div>
                <div className="mt-1 text-[12.5px] text-[var(--mut2)]">{t.q4hint}</div>
              </div>
              <div className="grid gap-[10px] sm:grid-cols-2">
                {addons.map((a) => {
                  const on = selected.includes(a.key);
                  return (
                    <label
                      key={a.key}
                      className="flex cursor-pointer items-center gap-3 rounded-[13px] px-[15px] py-[14px] transition-[background,border-color] duration-[180ms]"
                      style={{
                        border: `1.5px solid ${on ? "var(--accent)" : "var(--line2)"}`,
                        background: on ? "#fff" : "var(--paper)",
                        boxShadow: on ? "var(--shadow-amber-sm)" : "none",
                      }}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={on}
                        onChange={() =>
                          setSelected((cur) =>
                            cur.includes(a.key) ? cur.filter((k) => k !== a.key) : [...cur, a.key],
                          )
                        }
                      />
                      <span
                        aria-hidden
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px]"
                        style={{
                          background: on ? "var(--accent)" : "#fff",
                          border: on ? "1.5px solid var(--accent)" : "1.5px solid rgba(27,28,26,.18)",
                        }}
                      >
                        {on && (
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 6 9 17l-5-5" />
                          </svg>
                        )}
                      </span>
                      <span>
                        <span className="block text-[14px] font-semibold">{addonName(a.key)}</span>
                        <span className="tnum mt-0.5 block text-[11.5px] text-[var(--mut2)]">
                          +{formatEuro(a.rate, locale, 2)} / {t.perAptUnit}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Billing cycle */}
            <div className="border-t border-[var(--line2)] pt-[22px]">
              <div className="mb-4">
                <div className="text-[15.5px] font-bold">{t.q5}</div>
                <div className="mt-1 text-[12.5px] text-[var(--mut2)]">{t.q5hint}</div>
              </div>
              <div className="flex gap-1.5 rounded-[12px] bg-[rgba(27,28,26,.05)] p-1">
                {[
                  { on: !annual, label: t.monthly, set: () => setAnnual(false) },
                  { on: annual, label: t.annual, set: () => setAnnual(true) },
                ].map((seg) => (
                  <button
                    key={seg.label}
                    type="button"
                    onClick={seg.set}
                    aria-pressed={seg.on}
                    className={`flex-1 rounded-[9px] px-[10px] py-[11px] text-[13.5px] transition-[background,box-shadow] duration-[180ms] ${
                      seg.on
                        ? "bg-white font-bold text-[var(--txt)] shadow-[var(--shadow-seg)]"
                        : "font-semibold text-[var(--mut)]"
                    }`}
                  >
                    {seg.label}
                  </button>
                ))}
              </div>
            </div>
          </Card>

          {/* ── Result ───────────────────────────────────────────────── */}
          <div className="lg:sticky lg:top-[92px]">
            <div className="overflow-hidden rounded-[22px] shadow-[var(--shadow-card)]">
              <DarkPanel radius={0} className="px-8 pb-7 pt-8">
                <div className="u-caps text-[11.5px] font-extrabold tracking-[.14em] text-[rgba(255,255,255,.5)]">
                  {t.estimate}
                </div>
                <div className="mt-4 flex items-start gap-1.5" aria-live="polite">
                  <span className="tnum text-[52px] font-extrabold leading-[.9] tracking-[-.035em] text-[var(--accent)] sm:text-[62px]">
                    {formatEuro(r.perApartment, locale, 2)}
                  </span>
                  <span className="pt-1.5 text-[12.5px] text-[rgba(255,255,255,.62)]" style={{ maxWidth: 96 }}>
                    {t.perApartment}
                  </span>
                </div>
                <div className="tnum mt-[18px] text-[13px] text-[rgba(255,255,255,.55)]">
                  {t.scope(buildings, r.totalApartments)}
                </div>
              </DarkPanel>

              <div className="bg-white px-8 pb-[30px] pt-[26px]">
                {[
                  {
                    label: t.rowPlan,
                    value: `${planName(plan)} · ${formatEuro(r.planRate, locale, 2)}${r.minApplied ? t.minApplied : ""}`,
                  },
                  {
                    label: t.rowAddons,
                    value: r.addonCount === 0 ? "—" : `${r.addonCount} · +${formatEuro(r.addonRate, locale, 2)}`,
                  },
                  { label: t.rowBilling, value: annual ? t.annualValue : t.monthlyValue },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="flex items-baseline justify-between gap-3.5 border-b border-[var(--line2)] py-[11px]"
                  >
                    <span className="text-[13.5px] text-[var(--mut)]">{row.label}</span>
                    <span className="tnum text-right text-[13.5px] font-bold">{row.value}</span>
                  </div>
                ))}

                <div className="flex items-baseline justify-between gap-3 pb-1 pt-5">
                  <div>
                    <div className="text-[14.5px] font-bold">{t.totalLabel}</div>
                    <div className="tnum mt-0.5 text-[12.5px] text-[var(--mut2)]">
                      {formatEuro(r.yearlyTotal, locale, 0)} {t.perYear}
                    </div>
                  </div>
                  <div className="tnum text-[30px] font-extrabold tracking-[-.025em]">
                    {formatEuro(r.monthly, locale, 0)}
                  </div>
                </div>

                <div className="panel-amber mt-[18px] flex gap-[9px] rounded-[11px] px-[13px] py-[11px] text-[12.5px] font-semibold">
                  <span aria-hidden>💡</span>
                  <span>{annual ? t.saveAnnual(saving) : t.saveSwitch(saving)}</span>
                </div>

                <div className="mt-[22px] flex flex-col gap-[9px]">
                  <Link href={copy?.primaryCta?.href || "/contact"} className={btnClass("primary", "md", "w-full")}>
                    {copy?.primaryCta?.label || t.primary}
                  </Link>
                  <Link href={copy?.secondaryCta?.href || "/pricing"} className={btnClass("ghost", "md", "w-full")}>
                    {copy?.secondaryCta?.label || t.secondary}
                  </Link>
                </div>

                <p className="mt-4 text-center text-[11.5px] text-[var(--mut2)]">
                  {copy?.footnote || t.footnote}
                </p>
              </div>
            </div>
          </div>
        </div>
      </Wrap>
    </section>
  );
}
