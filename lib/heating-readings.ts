export type ReadingRow = { unitId: string; previousReading: number | null; currentReading: number | null };
export type ConsumptionResult = { unitId: string; consumption: number | null; negative: boolean };

/** consumption = current - previous. Missing current → null (no reading yet).
 *  Missing previous → treated as 0. current < previous → negative flag, clamped to 0
 *  (likely a meter reset / typo; never count negative usage). */
export function computeConsumption(rows: ReadingRow[]): ConsumptionResult[] {
  return rows.map((r) => {
    if (r.currentReading == null) return { unitId: r.unitId, consumption: null, negative: false };
    const prev = r.previousReading ?? 0;
    const diff = r.currentReading - prev;
    if (diff < 0) return { unitId: r.unitId, consumption: 0, negative: true };
    return { unitId: r.unitId, consumption: diff, negative: false };
  });
}

/** Map<unitId, consumption> for resolveWeights — only positive consumption. */
export function toConsumptionMap(rows: ReadingRow[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const c of computeConsumption(rows)) {
    if (c.consumption != null && c.consumption > 0) m.set(c.unitId, c.consumption);
  }
  return m;
}
