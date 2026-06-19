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
