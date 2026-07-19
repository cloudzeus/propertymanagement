/**
 * Pure per-unit grouping for the payments grid — deliberately free of any server
 * imports (no `@/lib/db`) so it can be bundled into the client `PaymentsTable`.
 * `payment-statements.ts` re-exports these for server callers + the unit test.
 */

/**
 * The minimal shape `groupRowsByUnit` needs — a structural subset of PaymentRow.
 * Kept narrow so the grouping helper stays pure + trivially testable while the
 * real PaymentRow (with `statement`/`heatingReadings`/…) still satisfies it.
 */
export type PaymentRowLike = {
  id: string; unitId: string; buildingId: string; buildingName: string;
  unitNumber: string; floor: number | null; month: string; myAmount: number; myPaid: boolean;
};

/** One collapsed row per unit: totals across all its months + the source months. */
export type UnitPaymentRow<R extends PaymentRowLike = PaymentRowLike> = {
  id: string; unitId: string; buildingId: string; buildingName: string; unitNumber: string; floor: number | null;
  outstanding: number; total: number; paid: boolean; months: R[];
};

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Collapse per-(unit,month) rows into one row per unit: `outstanding` = Σ of
 * unpaid `myAmount`, `total` = Σ of all `myAmount`, `paid` = no unpaid row, and
 * `months` = the unit's source rows newest-first. Pure — the payments grid uses
 * this to show one totals row per unit and the per-month analysis in the expand.
 */
export function groupRowsByUnit<R extends PaymentRowLike>(rows: R[]): UnitPaymentRow<R>[] {
  const by = new Map<string, UnitPaymentRow<R>>();
  for (const row of rows) {
    let u = by.get(row.unitId);
    if (!u) {
      u = {
        id: row.unitId, unitId: row.unitId, buildingId: row.buildingId, buildingName: row.buildingName,
        unitNumber: row.unitNumber, floor: row.floor, outstanding: 0, total: 0, paid: true, months: [],
      };
      by.set(row.unitId, u);
    }
    u.months.push(row);
    u.total += row.myAmount;
    if (!row.myPaid) { u.outstanding += row.myAmount; u.paid = false; }
  }
  return [...by.values()].map((u) => ({
    ...u, outstanding: r2(u.outstanding), total: r2(u.total),
    months: [...u.months].sort((a, b) => b.month.localeCompare(a.month)),
  }));
}
