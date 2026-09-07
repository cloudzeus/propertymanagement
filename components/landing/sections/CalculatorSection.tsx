import { CostCalculator, type CalculatorCopy } from "@/components/calculator/CostCalculator";
import { resolveCalculator } from "@/lib/pricing/resolve";
import type { CalculatorData } from "@/lib/cms/landing-types";

export function CalculatorSection({ data }: { data: CalculatorData }) {
  const d = data ?? {};
  const r = resolveCalculator(d);

  const copy: CalculatorCopy = {
    kicker: d.kicker || undefined,
    heading: d.heading || undefined,
    lead: d.lead || undefined,
    footnote: d.footnote || undefined,
    primaryCta: d.primaryCta?.label ? d.primaryCta : undefined,
    secondaryCta: d.secondaryCta?.label ? d.secondaryCta : undefined,
    planNames: r.planNames as CalculatorCopy["planNames"],
    planUnits: r.planUnits as CalculatorCopy["planUnits"],
    addonNames: r.addonNames as CalculatorCopy["addonNames"],
  };

  return (
    <CostCalculator
      copy={copy}
      plans={r.plans}
      addons={r.addons}
      annualMultiplier={r.annualMultiplier}
    />
  );
}
