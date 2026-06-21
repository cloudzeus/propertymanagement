export type MillesimeInput = { id: string; areaSqm: number | null };
export type MillesimeResult = { id: string; millesimes: number | null };

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Distribute 1000 χιλιοστά across units proportionally to their τετραγωνικά.
 * Units with no/zero area get `millesimes: null` and are excluded from the
 * distribution. The rounding remainder is absorbed by the largest-area unit so
 * the non-null results sum to exactly 1000.00.
 */
export function computeMillesimes(units: MillesimeInput[]): MillesimeResult[] {
  const withArea = units.filter((u) => u.areaSqm != null && u.areaSqm > 0);
  const total = withArea.reduce((s, u) => s + (u.areaSqm as number), 0);

  if (total <= 0) {
    return units.map((u) => ({ id: u.id, millesimes: null }));
  }

  const raw = new Map<string, number>();
  for (const u of withArea) {
    raw.set(u.id, round2(((u.areaSqm as number) / total) * 1000));
  }

  const assigned = [...raw.values()].reduce((s, v) => s + v, 0);
  const remainder = round2(1000 - assigned);
  if (remainder !== 0) {
    const largest = withArea.reduce((a, b) =>
      (b.areaSqm as number) > (a.areaSqm as number) ? b : a
    );
    raw.set(largest.id, round2((raw.get(largest.id) as number) + remainder));
  }

  return units.map((u) => ({
    id: u.id,
    millesimes: raw.has(u.id) ? (raw.get(u.id) as number) : null,
  }));
}

export type WeightInput = { id: string; weight: number };
export type WeightResult = { id: string; value: number | null };

/** Distribute exactly 1000 across positive weights; remainder on the largest
 *  weight. Zero/negative weights → null (excluded). All-zero → all null. */
export function distributeWeights(items: WeightInput[]): WeightResult[] {
  const positive = items.filter((i) => i.weight > 0);
  const total = positive.reduce((s, i) => s + i.weight, 0);
  if (total <= 0) return items.map((i) => ({ id: i.id, value: null }));

  const raw = new Map<string, number>();
  for (const i of positive) raw.set(i.id, round2((i.weight / total) * 1000));

  const assigned = [...raw.values()].reduce((s, v) => s + v, 0);
  const remainder = round2(1000 - assigned);
  if (remainder !== 0) {
    const largest = positive.reduce((a, b) => (b.weight > a.weight ? b : a));
    raw.set(largest.id, round2((raw.get(largest.id) as number) + remainder));
  }
  return items.map((i) => ({ id: i.id, value: raw.has(i.id) ? (raw.get(i.id) as number) : null }));
}

/** Elevator weight for a unit: area × (1 + surcharge × floor). Ground floor
 *  (floor 0) is 0 when exemptGround is true. Null area → 0. */
export function elevatorWeight(
  areaSqm: number | null,
  floor: number | null,
  surchargePerFloor: number,
  exemptGround: boolean,
): number {
  const area = areaSqm ?? 0;
  const fl = floor ?? 0;
  if (exemptGround && fl === 0) return 0;
  return area * (1 + surchargePerFloor * fl);
}
