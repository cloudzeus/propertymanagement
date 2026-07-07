import { getBilledCost } from "@/lib/api-costs";

export interface PricingConfig {
  costModel: string; // 'per_token' | 'per_minute' | 'per_gb' | 'per_request' | 'per_email'
  basePrice: number;
  freeQuota: number;
}

export interface UsageUnits {
  tokensUsed?: number;
  minutes?: number;
  bytesProcessed?: number;
  requestCount?: number;
}

/** Real provider cost in EUR, matching the semantics used in lib/api-costs.logAPIUsage. */
export function computeRealCost(config: PricingConfig, units: UsageUnits): number {
  const free = config.freeQuota || 0;
  switch (config.costModel) {
    case "per_token":
      return ((units.tokensUsed || 0) / 1000) * config.basePrice;
    case "per_minute":
      return (units.minutes || 0) * config.basePrice;
    case "per_gb": {
      const gb = (units.bytesProcessed || 0) / (1024 * 1024 * 1024);
      return Math.max(0, gb - free) * config.basePrice;
    }
    case "per_request":
    case "per_email":
    default:
      return (units.requestCount || 1) * config.basePrice;
  }
}

/** billed = real × (1 + markup#1); customerCharge = billed × (1 + markup#2). */
export function computeCharges(realCost: number, markup1Percent: number, markup2Percent: number) {
  const billedCostEur = getBilledCost(realCost, markup1Percent);
  const customerChargeEur = getBilledCost(billedCostEur, markup2Percent);
  return { realCost, billedCostEur, customerChargeEur };
}
