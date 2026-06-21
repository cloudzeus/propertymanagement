import type { DistributionBasis } from "@prisma/client";

export type BasisUnit = {
  unitId: string;
  millesimes: number | null;
  millesimesElevator: number | null;
  millesimesHeating: number | null;
  excluded: boolean;
};

/** Produce a raw per-unit weight map for the given basis. Excluded units always
 *  weigh 0. Re-normalisation to 1000 happens later in computeAllocation by
 *  dividing by the sum of participating weights. `meterReadings` is required
 *  only for METERED_70_30 (unitId → consumption). */
export function resolveWeights(
  basis: DistributionBasis,
  units: BasisUnit[],
  meterReadings: Map<string, number> | null,
): Map<string, number> {
  const w = new Map<string, number>();

  if (basis === "EQUAL_PER_UNIT") {
    for (const u of units) w.set(u.unitId, u.excluded ? 0 : 1);
    return w;
  }

  if (basis === "METERED_70_30") {
    const readings = meterReadings ?? new Map();
    const participants = units.filter((u) => !u.excluded);
    const totalReading = participants.reduce((s, u) => s + (readings.get(u.unitId) ?? 0), 0);
    const totalHeating = participants.reduce((s, u) => s + (u.millesimesHeating ?? 0), 0);
    for (const u of units) {
      if (u.excluded) { w.set(u.unitId, 0); continue; }
      // Combine into a single comparable weight: 0.70 by metered fraction,
      // 0.30 by heating-millesime fraction. Falls back to pure heating if no
      // readings exist (totalReading === 0).
      const meterPart = totalReading > 0 ? (readings.get(u.unitId) ?? 0) / totalReading : 0;
      const heatPart = totalHeating > 0 ? (u.millesimesHeating ?? 0) / totalHeating : 0;
      const combined = totalReading > 0 ? 0.7 * meterPart + 0.3 * heatPart : heatPart;
      w.set(u.unitId, combined);
    }
    return w;
  }

  const pick = (u: BasisUnit) =>
    basis === "ELEVATOR_MILLESIMES" ? u.millesimesElevator
    : basis === "HEATING_MILLESIMES" ? u.millesimesHeating
    : u.millesimes;

  for (const u of units) w.set(u.unitId, u.excluded ? 0 : (pick(u) ?? 0));
  return w;
}
