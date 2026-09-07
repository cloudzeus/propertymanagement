import { ADDONS, PLANS, type Addon, type Plan } from "@/lib/pricing/calculator";
import type { CalculatorData } from "@/lib/cms/landing-types";

/** A CMS value only overrides the constant when it is a real, positive number —
 *  a blank field in the editor must never price a plan at €0. */
export function num(v: unknown, fallback: number): number {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : fallback;
}

function text(map: Record<string, string> | undefined, key: string): string | undefined {
  const v = map?.[key];
  return v && v.trim() ? v : undefined;
}

export interface ResolvedCalculator {
  plans: Plan[];
  addons: Addon[];
  annualMultiplier: number;
  planNames: Record<string, string>;
  planUnits: Record<string, string>;
  addonNames: Record<string, string>;
}

/**
 * Turns the CALCULATOR CMS section into the numbers the calculator and the
 * pricing page both run on, so the two surfaces can never quote different
 * rates or a different annual discount.
 */
export function resolveCalculator(data: CalculatorData | null | undefined): ResolvedCalculator {
  const d = data ?? {};
  const pick = (map: Record<string, string> | undefined, keys: readonly string[]) =>
    Object.fromEntries(
      keys.map((k) => [k, text(map, k)]).filter(([, v]) => v),
    ) as Record<string, string>;

  return {
    plans: PLANS.map((p) => ({
      key: p.key,
      rate: num(d.rates?.[p.key], p.rate),
      minPerBuilding: num(d.minimums?.[p.key], p.minPerBuilding),
    })),
    addons: ADDONS.map((a) => ({ key: a.key, rate: num(d.addonRates?.[a.key], a.rate) })),
    annualMultiplier: num(d.annualMultiplier, 0.8),
    planNames: pick(d.planNames, PLANS.map((p) => p.key)),
    planUnits: pick(d.planUnits, PLANS.map((p) => p.key)),
    addonNames: pick(d.addonNames, ADDONS.map((a) => a.key)),
  };
}
