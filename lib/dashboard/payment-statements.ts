import { db } from "@/lib/db";
import { buildUnitStatement, type StatementBasis, type UnitStatementInput } from "@/lib/building/statement";
import type { StatementWithPaid } from "@/components/building/occupant-shell/UnitStatementDocument";

/** ExpenseStatus values visible to occupants — DRAFT entries are staff work-in-progress. */
const VISIBLE_STATUSES = ["CONFIRMED", "ISSUED"] as const;
const r2 = (n: number) => Math.round(n * 100) / 100;

type Side = "OWNER" | "TENANT";

/**
 * One statement per (unit, issuance-month) for the payment tables. Each row
 * carries the FULL per-apartment `UnitStatement` (via buildUnitStatement) so the
 * DataTable expand + modal can render the whole ειδοποιητήριο analysis inline.
 */
export type PaymentRow = {
  id: string;               // `${unitId}:${month}`
  unitId: string;
  unitNumber: string;
  unitType: string;
  floor: number | null;
  buildingId: string;
  buildingName: string;
  buildingAddress: string | null;
  buildingCity: string | null;
  month: string;            // issuance month (issuedMonth ?? month), YYYY-MM
  role: "OWNER" | "RESIDENT" | "BOTH";
  statement: StatementWithPaid;
  /** The viewer's role-aware payable — equals statement.myPayable (OWNER role → ownerTotal, RESIDENT → tenantTotal, BOTH → total). */
  myAmount: number;
  /** Every role-relevant allocation with a positive amount is paid. */
  myPaid: boolean;
  /** statement.total = ownerTotal + tenantTotal (the whole unit αναλογία). */
  unitTotal: number;
  receiptUrls: string[];
  /** Metered heating readings for this unit + month (empty when the building has none). */
  heatingReadings: { unitId: string; unitNumber: string; previousReading: number | null; currentReading: number | null; consumption: number | null }[];
};

/**
 * Build per-(unit,month) payment rows for `userId` seen from one side.
 *
 * Money attribution mirrors lib/building/occupant-data.ts exactly: the split
 * columns are UNGATED (unitAmount = ownerAmount + tenantAmount, unitOwner =
 * ownerAmount, unitTenant = tenantAmount) so total === ownerTotal + tenantTotal
 * always holds — that stays the apartment's true division in the analysis.
 *
 * `side` ONLY decides which units are listed (OWNER page → owned units, TENANT
 * page → occupied units). The row's `myAmount`/`myPaid` are ROLE-aware, always
 * equal to the notice's ΠΛΗΡΩΤΕΟ (statement.myPayable), so the column never
 * disagrees with the expanded notice. A unit the viewer owns but rents out
 * (owner owes 0) yields myAmount === 0 → «Καμία οφειλή»; a self-occupied unit
 * shows its real payable → «Οφειλή {amount}».
 */
export async function buildPaymentRows(userId: string, side: Side): Promise<PaymentRow[]> {
  const unitRows = await db.unit.findMany({
    where: {
      OR: [{ ownerId: userId }, { residentId: userId }, { occupancies: { some: { userId, endDate: null } } }],
    },
    orderBy: { unitNumber: "asc" },
    select: {
      id: true, unitNumber: true, unitType: true, floor: true,
      millesimes: true, millesimesElevator: true, millesimesHeating: true,
      ownerId: true, residentId: true,
      occupancies: { where: { userId, endDate: null }, select: { role: true } },
      building: { select: { id: true, name: true, address: true, city: true } },
    },
  });

  // Viewer relationship per unit (strict money attribution, as in occupant-data):
  // tenant side when residentId===user OR an open RESIDENT occupancy; owner side
  // only when ownerId===user. Keep only the units relevant to the requested side.
  const myUnits = unitRows
    .map((u) => {
      const occRoles = new Set(u.occupancies.map((o) => o.role));
      const tenantSide = u.residentId === userId || occRoles.has("RESIDENT");
      const ownerSide = u.ownerId === userId;
      const role: "OWNER" | "RESIDENT" | "BOTH" =
        ownerSide && tenantSide ? "BOTH" : tenantSide ? "RESIDENT" : "OWNER";
      return { ...u, tenantSide, ownerSide, role };
    })
    .filter((u) => (side === "OWNER" ? u.ownerSide : u.tenantSide));

  if (myUnits.length === 0) return [];

  const unitById = new Map(myUnits.map((u) => [u.id, u]));
  const myUnitIds = myUnits.map((u) => u.id);
  const buildingIds = [...new Set(myUnits.map((u) => u.building.id))];

  const [overrides, heatingRows, expenseRows] = await Promise.all([
    db.buildingCategoryOverride.findMany({
      where: { buildingId: { in: buildingIds } },
      select: { buildingId: true, categoryId: true, distributionBasis: true },
    }),
    db.unitHeatingReading.findMany({
      where: { unitId: { in: myUnitIds } },
      select: { unitId: true, period: true, previousReading: true, currentReading: true, consumption: true },
    }),
    db.buildingExpense.findMany({
      where: { buildingId: { in: buildingIds }, status: { in: [...VISIBLE_STATUSES] } },
      orderBy: [{ documentDate: "desc" }, { createdAt: "desc" }],
      select: {
        id: true, buildingId: true, month: true, issuedMonth: true, category: true,
        tenantPct: true, ownerPct: true, amount: true, categoryId: true,
        categoryRef: { select: { name: true, defaultBasis: true } },
        receiptFile: { select: { url: true } },
        allocations: {
          where: { unitId: { in: myUnitIds } },
          select: { unitId: true, tenantAmount: true, tenantPaid: true, ownerAmount: true, ownerPaid: true },
        },
      },
    }),
  ]);

  // Basis resolution per building: building override → category default → GENERAL_MILLESIMES.
  const overrideBasis = new Map(overrides.map((o) => [`${o.buildingId}:${o.categoryId}`, o.distributionBasis]));
  const basisOf = (e: {
    buildingId: string; categoryId: string | null; categoryRef: { defaultBasis: StatementBasis } | null;
  }): StatementBasis =>
    (e.categoryId ? overrideBasis.get(`${e.buildingId}:${e.categoryId}`) : null) ?? e.categoryRef?.defaultBasis ?? "GENERAL_MILLESIMES";

  // Heating readings keyed by `${unitId}:${period}` — attached to the matching row.
  const heatingByKey = new Map<string, PaymentRow["heatingReadings"]>();
  for (const h of heatingRows) {
    const u = unitById.get(h.unitId);
    if (!u) continue;
    const key = `${h.unitId}:${h.period}`;
    const arr = heatingByKey.get(key) ?? [];
    arr.push({
      unitId: h.unitId, unitNumber: u.unitNumber,
      previousReading: h.previousReading != null ? Number(h.previousReading) : null,
      currentReading: h.currentReading != null ? Number(h.currentReading) : null,
      consumption: h.consumption != null ? Number(h.consumption) : null,
    });
    heatingByKey.set(key, arr);
  }

  // Accumulate per (unit, month): notice inputs, paid counters, receipts, my-side total.
  type Bucket = {
    inputs: UnitStatementInput[];
    receiptUrls: Set<string>;
    myAmount: number;
    myUnpaidWithAmount: number; // my-side allocations with amount>0 that are unpaid
    tCnt: number; tPaid: number; oCnt: number; oPaid: number;
  };
  const buckets = new Map<string, Bucket>();

  for (const e of expenseRows) {
    const month = e.issuedMonth ?? e.month;
    const shared = {
      id: e.id,
      categoryName: e.categoryRef?.name ?? e.category ?? "Λοιπά έξοδα",
      basis: basisOf(e),
      amount: Number(e.amount),
      tenantPct: e.tenantPct,
      ownerPct: e.ownerPct,
    };
    for (const a of e.allocations) {
      const u = unitById.get(a.unitId);
      if (!u) continue; // allocation for a unit outside the requested side
      const key = `${a.unitId}:${month}`;
      let b = buckets.get(key);
      if (!b) {
        b = { inputs: [], receiptUrls: new Set(), myAmount: 0, myUnpaidWithAmount: 0, tCnt: 0, tPaid: 0, oCnt: 0, oPaid: 0 };
        buckets.set(key, b);
      }
      const ownerAmount = Number(a.ownerAmount);
      const tenantAmount = Number(a.tenantAmount);
      // UNGATED per-unit notice row: the columns provably sum (unitAmount = owner + tenant).
      b.inputs.push({ ...shared, unitAmount: r2(ownerAmount + tenantAmount), unitTenant: r2(tenantAmount), unitOwner: r2(ownerAmount), receiptUrl: e.receiptFile?.url ?? null });
      if (e.receiptFile?.url) b.receiptUrls.add(e.receiptFile.url);

      // Both-side paid flags (drive the notice's settled badge).
      b.tCnt += 1; if (a.tenantPaid) b.tPaid += 1;
      b.oCnt += 1; if (a.ownerPaid) b.oPaid += 1;

      // My share + paid state — ROLE-aware, NOT side-gated: the column mirrors
      // the notice's ΠΛΗΡΩΤΕΟ (statement.myPayable) exactly. OWNER role → owner
      // amount, RESIDENT → tenant, BOTH (self-occupied) → owner + tenant.
      const wantOwner = u.role === "OWNER" || u.role === "BOTH";
      const wantTenant = u.role === "RESIDENT" || u.role === "BOTH";
      if (wantOwner) { b.myAmount += ownerAmount; if (ownerAmount > 0 && !a.ownerPaid) b.myUnpaidWithAmount += 1; }
      if (wantTenant) { b.myAmount += tenantAmount; if (tenantAmount > 0 && !a.tenantPaid) b.myUnpaidWithAmount += 1; }
    }
  }

  const rows: PaymentRow[] = [];
  for (const [key, b] of buckets) {
    const [unitId, month] = [key.slice(0, key.lastIndexOf(":")), key.slice(key.lastIndexOf(":") + 1)];
    const u = unitById.get(unitId)!;
    const st = buildUnitStatement(
      {
        unitId: u.id, unitNumber: u.unitNumber, unitType: u.unitType, floor: u.floor, role: u.role,
        millesimes: u.millesimes, millesimesElevator: u.millesimesElevator, millesimesHeating: u.millesimesHeating,
      },
      b.inputs,
    );
    rows.push({
      id: key,
      unitId: u.id,
      unitNumber: u.unitNumber,
      unitType: u.unitType,
      floor: u.floor,
      buildingId: u.building.id,
      buildingName: u.building.name,
      buildingAddress: u.building.address,
      buildingCity: u.building.city,
      month,
      role: u.role,
      statement: {
        ...st,
        tenantPaid: b.tCnt > 0 ? b.tPaid === b.tCnt : null,
        ownerPaid: b.oCnt > 0 ? b.oPaid === b.oCnt : null,
      },
      myAmount: r2(b.myAmount),
      myPaid: b.myUnpaidWithAmount === 0,
      unitTotal: st.total,
      receiptUrls: [...b.receiptUrls],
      heatingReadings: heatingByKey.get(key) ?? [],
    });
  }

  // Newest month first, then by unit number.
  rows.sort((a, b) => (a.month === b.month ? a.unitNumber.localeCompare(b.unitNumber, "el") : b.month.localeCompare(a.month)));
  return rows;
}

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

/** Owner perspective: the viewer's owned units, my-side share = owner amount. */
export function getOwnerPaymentRows(userId: string): Promise<PaymentRow[]> {
  return buildPaymentRows(userId, "OWNER");
}

/** Resident perspective: the viewer's occupied units, my-side share = tenant amount. */
export function getResidentPaymentRows(userId: string): Promise<PaymentRow[]> {
  return buildPaymentRows(userId, "TENANT");
}
