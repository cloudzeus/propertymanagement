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
  /** The viewer-side share for this row (OWNER side → Σ ownerAmount, TENANT → Σ tenantAmount). */
  myAmount: number;
  /** Every my-side allocation with a positive amount is paid. */
  myPaid: boolean;
  /** statement.total = ownerTotal + tenantTotal (the whole unit αναλογία). */
  unitTotal: number;
  receiptUrls: string[];
};

/**
 * Build per-(unit,month) payment rows for `userId` seen from one side.
 *
 * Money attribution mirrors lib/building/occupant-data.ts exactly: the columns
 * are UNGATED (unitAmount = ownerAmount + tenantAmount, unitOwner = ownerAmount,
 * unitTenant = tenantAmount) so total === ownerTotal + tenantTotal always holds;
 * only `myAmount`/`myPaid` are gated to the viewer's side. A unit the viewer owns
 * where the tenant pays 100% therefore yields myAmount === 0 (no owner debt) —
 * NOT a phantom «Οφειλή».
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

  const [overrides, expenseRows] = await Promise.all([
    db.buildingCategoryOverride.findMany({
      where: { buildingId: { in: buildingIds } },
      select: { buildingId: true, categoryId: true, distributionBasis: true },
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
      b.inputs.push({ ...shared, unitAmount: r2(ownerAmount + tenantAmount), unitTenant: r2(tenantAmount), unitOwner: r2(ownerAmount) });
      if (e.receiptFile?.url) b.receiptUrls.add(e.receiptFile.url);

      // Both-side paid flags (drive the notice's settled badge).
      b.tCnt += 1; if (a.tenantPaid) b.tPaid += 1;
      b.oCnt += 1; if (a.ownerPaid) b.oPaid += 1;

      // My-side share + paid state (drive the row column + status).
      const sideAmount = side === "OWNER" ? ownerAmount : tenantAmount;
      const sidePaid = side === "OWNER" ? a.ownerPaid : a.tenantPaid;
      b.myAmount += sideAmount;
      if (sideAmount > 0 && !sidePaid) b.myUnpaidWithAmount += 1;
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
    });
  }

  // Newest month first, then by unit number.
  rows.sort((a, b) => (a.month === b.month ? a.unitNumber.localeCompare(b.unitNumber, "el") : b.month.localeCompare(a.month)));
  return rows;
}

/** Owner perspective: the viewer's owned units, my-side share = owner amount. */
export function getOwnerPaymentRows(userId: string): Promise<PaymentRow[]> {
  return buildPaymentRows(userId, "OWNER");
}

/** Resident perspective: the viewer's occupied units, my-side share = tenant amount. */
export function getResidentPaymentRows(userId: string): Promise<PaymentRow[]> {
  return buildPaymentRows(userId, "TENANT");
}
