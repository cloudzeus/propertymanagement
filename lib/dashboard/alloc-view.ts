/** Row shape shared by owner/resident payment pages. */
export type AllocRow = {
  id: string; month: string; unitLabel: string; description: string | null;
  amount: number; paid: boolean; receiptUrl: string | null;
};

export type MonthGroup = { month: string; rows: AllocRow[]; total: number; unpaid: number };

export function groupAllocationsByMonth(rows: AllocRow[]): {
  months: MonthGroup[]; total: number; totalUnpaid: number;
} {
  const byMonth = new Map<string, MonthGroup>();
  for (const r of rows) {
    let g = byMonth.get(r.month);
    if (!g) { g = { month: r.month, rows: [], total: 0, unpaid: 0 }; byMonth.set(r.month, g); }
    g.rows.push(r);
    g.total += r.amount;
    if (!r.paid) g.unpaid += r.amount;
  }
  const months = [...byMonth.values()].sort((a, b) => b.month.localeCompare(a.month));
  return {
    months,
    total: months.reduce((s, m) => s + m.total, 0),
    totalUnpaid: months.reduce((s, m) => s + m.unpaid, 0),
  };
}

export type DuoPoint = { month: string; owner: number; tenant: number };

/** Sum owner/tenant amounts per month, aligned to `months` (missing → 0). */
export function duoTrend(rows: DuoPoint[], months: string[]): DuoPoint[] {
  const bucket = new Map<string, { owner: number; tenant: number }>(
    months.map((m) => [m, { owner: 0, tenant: 0 }]),
  );
  for (const r of rows) {
    const b = bucket.get(r.month);
    if (b) { b.owner += r.owner; b.tenant += r.tenant; }
  }
  return months.map((m) => ({ month: m, ...bucket.get(m)! }));
}
