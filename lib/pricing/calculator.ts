/**
 * Cost-calculator pricing model — handoff 04 §1.
 *
 * Pure and dependency-free so the calculator, the pricing page and any future
 * quote flow all read the same numbers. Rates are € per apartment per month,
 * VAT excluded.
 */

export type PlanKey = "essential" | "standard" | "pro";
export type AddonKey = "payments" | "technician" | "accounting";

export interface Plan {
  key: PlanKey;
  rate: number;
  /** Floor per building, per month — NOT per portfolio. */
  minPerBuilding: number;
}

export interface Addon {
  key: AddonKey;
  rate: number;
}

export const PLANS: readonly Plan[] = [
  { key: "essential", rate: 1.2, minPerBuilding: 18 },
  { key: "standard", rate: 2.2, minPerBuilding: 32 },
  { key: "pro", rate: 3.4, minPerBuilding: 55 },
] as const;

export const ADDONS: readonly Addon[] = [
  { key: "payments", rate: 0.35 },
  { key: "technician", rate: 0.45 },
  { key: "accounting", rate: 0.25 },
] as const;

/** Annual billing = −20%. */
export const ANNUAL_MULTIPLIER = 0.8;

export const SLIDER_LIMITS = {
  buildings: { min: 1, max: 120, step: 1 },
  apartments: { min: 2, max: 80, step: 1 },
} as const;

/** Handoff 04 §1 — these land on €2.04/apt/month, €2,285/month. Do not change without a reason. */
export const CALC_DEFAULTS = {
  buildings: 8,
  apartmentsPerBuilding: 14,
  plan: "standard" as PlanKey,
  annual: true,
  addons: ["payments"] as AddonKey[],
};

export interface CalcInput {
  buildings: number;
  apartmentsPerBuilding: number;
  plan: PlanKey;
  annual: boolean;
  addons: AddonKey[];
  /** Optional CMS overrides — falls back to the constants above. */
  plans?: readonly Plan[];
  addonRates?: readonly Addon[];
  annualMultiplier?: number;
}

export interface CalcResult {
  totalApartments: number;
  addonRate: number;
  addonCount: number;
  planRate: number;
  planMinimum: number;
  planPerBuilding: number;
  /** True when the per-building floor binds — the UI must surface this. */
  minApplied: boolean;
  grossMonthly: number;
  monthly: number;
  perApartment: number;
  yearlyTotal: number;
  /** Always derived from the gross figure, so the callout reads the same on either cycle. */
  yearlySaving: number;
}

export function findPlan(key: PlanKey, plans: readonly Plan[] = PLANS): Plan {
  return plans.find((p) => p.key === key) ?? plans[0];
}

export function calculate(input: CalcInput): CalcResult {
  const plans = input.plans?.length ? input.plans : PLANS;
  const addonDefs = input.addonRates?.length ? input.addonRates : ADDONS;
  const multiplier = input.annualMultiplier ?? ANNUAL_MULTIPLIER;

  const buildings = Math.max(1, Math.round(input.buildings));
  const apartmentsPerBuilding = Math.max(1, Math.round(input.apartmentsPerBuilding));
  const plan = findPlan(input.plan, plans);

  const totalApartments = buildings * apartmentsPerBuilding;

  const selected = addonDefs.filter((a) => input.addons.includes(a.key));
  const addonRate = selected.reduce((sum, a) => sum + a.rate, 0);

  const rawPerBuilding = apartmentsPerBuilding * plan.rate;
  const planPerBuilding = Math.max(rawPerBuilding, plan.minPerBuilding);
  const minApplied = rawPerBuilding < plan.minPerBuilding;

  const grossMonthly = buildings * planPerBuilding + totalApartments * addonRate;
  const monthly = input.annual ? grossMonthly * multiplier : grossMonthly;

  return {
    totalApartments,
    addonRate,
    addonCount: selected.length,
    planRate: plan.rate,
    planMinimum: plan.minPerBuilding,
    planPerBuilding,
    minApplied,
    grossMonthly,
    monthly,
    perApartment: totalApartments > 0 ? monthly / totalApartments : 0,
    yearlyTotal: monthly * 12,
    yearlySaving: grossMonthly * 12 * (1 - multiplier),
  };
}

/** €-prefixed, locale-correct. Never hand-roll the separator swap (handoff 04 §1). */
export function formatEuro(value: number, locale: "el" | "en", decimals = 0): string {
  const nf = new Intl.NumberFormat(locale === "el" ? "el-GR" : "en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `€${nf.format(value)}`;
}

/** Filled portion of a range input, as a percentage of its track. */
export function sliderPercent(value: number, min: number, max: number): number {
  if (max === min) return 0;
  return ((value - min) / (max - min)) * 100;
}
