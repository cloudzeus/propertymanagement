export type AllocUnit = {
  unitId: string;
  weight: number;
  ownerUserId: string | null;
  tenantUserId: string | null;
};

export type AllocRow = {
  unitId: string;
  unitShare: number;
  tenantUserId: string | null;
  tenantAmount: number;
  ownerUserId: string | null;
  ownerAmount: number;
  missingWeight: boolean;
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function computeAllocation(args: {
  total: number; tenantPct: number; ownerPct: number; units: AllocUnit[];
}): AllocRow[] {
  const { total, tenantPct, units } = args;
  const weighted = units.filter((u) => u.weight > 0);
  const weight = weighted.reduce((s, u) => s + u.weight, 0);
  const lastWeightedId = weighted.length ? weighted[weighted.length - 1].unitId : null;

  let running = 0;
  return units.map((u) => {
    const hasWeight = u.weight > 0;
    let share = 0;
    if (weight > 0 && hasWeight) {
      if (u.unitId === lastWeightedId) {
        share = round2(total - running);
      } else {
        share = round2((total * u.weight) / weight);
        running += share;
      }
    }
    const tenantAmount = round2((share * tenantPct) / 100);
    const ownerAmount = round2(share - tenantAmount);
    return { unitId: u.unitId, unitShare: share, tenantUserId: u.tenantUserId, tenantAmount, ownerUserId: u.ownerUserId, ownerAmount, missingWeight: !hasWeight };
  });
}

export function resolveSplit(
  category: { defaultTenantPct: number; defaultOwnerPct: number },
  override: { tenantPct: number; ownerPct: number } | null,
): { tenantPct: number; ownerPct: number } {
  if (override) return { tenantPct: override.tenantPct, ownerPct: override.ownerPct };
  return { tenantPct: category.defaultTenantPct, ownerPct: category.defaultOwnerPct };
}
