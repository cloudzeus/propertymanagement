/** Greek-locale euro, e.g. €1.234,50 */
export function formatEuro(n: number): string {
  return "€" + n.toLocaleString("el-GR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export interface Occupancy { total: number; occupied: number; vacant: number; rate: number }

export function occupancy(units: { residentId: string | null }[]): Occupancy {
  const total = units.length;
  const occupied = units.filter((u) => u.residentId !== null).length;
  const vacant = total - occupied;
  const rate = total === 0 ? 0 : Math.round((occupied / total) * 100);
  return { total, occupied, vacant, rate };
}

export function sumUnpaid(rows: { amount: number; paid: boolean }[]): number {
  return rows.reduce((acc, r) => (r.paid ? acc : acc + r.amount), 0);
}

export interface Collection { collected: number; total: number; pct: number }

export function collectionRate(collected: number, total: number): Collection {
  const pct = total === 0 ? 0 : Math.round((collected / total) * 100);
  return { collected, total, pct };
}

/** N month keys (YYYY-MM) ending at `anchor` inclusive, oldest first. */
export function lastNMonths(anchor: string, n: number): string[] {
  const [y, m] = anchor.split("-").map(Number);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

export interface TrendPoint { month: string; value: number }

export function monthlyTrend(rows: { month: string; amount: number }[], months: string[]): TrendPoint[] {
  const bucket = new Map<string, number>(months.map((mm) => [mm, 0]));
  for (const r of rows) {
    if (bucket.has(r.month)) bucket.set(r.month, (bucket.get(r.month) ?? 0) + r.amount);
  }
  return months.map((mm) => ({ month: mm, value: bucket.get(mm) ?? 0 }));
}
