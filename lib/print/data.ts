import "server-only";
import { db } from "@/lib/db";
import { buildUnitStatement, type StatementBasis, type UnitStatement, type UnitStatementInput } from "@/lib/building/statement";

/* ────────────────────────────────────────────────────────────────────────────
   Read-only loaders for the printable documents (manager → owners/residents).
   All money math reuses lib/building/statement.ts so the printed ειδοποιητήριο
   matches the on-screen one to the cent.
   ──────────────────────────────────────────────────────────────────────────── */

const VISIBLE_STATUSES = ["CONFIRMED", "ISSUED"] as const;
const n = (v: unknown) => (v == null ? 0 : Number(v));
const r2 = (x: number) => Math.round(x * 100) / 100;

export type PrintUnit = {
  id: string; unitNumber: string; unitType: string; floor: number | null; areaSqm: number | null;
  millesimes: number | null; millesimesElevator: number | null; millesimesHeating: number | null;
  ownerId: string | null; ownerName: string | null; residentId: string | null; residentName: string | null;
};

export type PrintBuilding = {
  id: string; name: string; address: string; city: string; postalCode: string;
  floors: number | null; hasElevator: boolean; propertyName: string; managed: boolean;
  managerName: string | null; managerPhone: string | null; managerEmail: string | null;
  units: PrintUnit[];
  /** Issuance months (issuedMonth ?? month) — newest first. */
  months: string[];
  /** Months with at least one ISSUED expense — newest first. */
  issuedMonths: string[];
};

export async function loadPrintBuilding(buildingId: string): Promise<PrintBuilding | null> {
  const [b, units, monthRows, contacts, assignments] = await Promise.all([
    db.building.findUnique({
      where: { id: buildingId },
      select: { id: true, name: true, address: true, city: true, postalCode: true, floors: true, hasElevator: true, property: { select: { name: true, managed: true } } },
    }),
    db.unit.findMany({
      where: { buildingId },
      orderBy: [{ floor: "asc" }, { unitNumber: "asc" }],
      select: {
        id: true, unitNumber: true, unitType: true, floor: true, areaSqm: true,
        millesimes: true, millesimesElevator: true, millesimesHeating: true,
        ownerId: true, residentId: true, owner: { select: { name: true, email: true } }, resident: { select: { name: true, email: true } },
      },
    }),
    db.buildingExpense.findMany({ where: { buildingId, status: { in: [...VISIBLE_STATUSES] } }, select: { month: true, issuedMonth: true, status: true } }),
    db.contact.findMany({ where: { buildingId }, select: { name: true, category: true, phone: true, email: true } }),
    db.managementAssignment.findMany({ where: { OR: [{ buildingId }, { property: { buildings: { some: { id: buildingId } } } }] }, select: { user: { select: { name: true, email: true, phone: true } } } }).catch(() => []),
  ]);
  if (!b) return null;
  const managerContact = contacts.find((c) => c.category?.includes("ιαχειρ")) ?? null;
  const managerUser = assignments[0]?.user ?? null;
  const months = [...new Set(monthRows.map((r) => r.issuedMonth ?? r.month))].sort().reverse();
  const issuedMonths = [...new Set(monthRows.filter((r) => r.status === "ISSUED" || r.issuedMonth).map((r) => r.issuedMonth ?? r.month))].sort().reverse();
  return {
    id: b.id, name: b.name, address: b.address, city: b.city, postalCode: b.postalCode, floors: b.floors, hasElevator: b.hasElevator,
    propertyName: b.property.name, managed: b.property.managed,
    managerName: managerContact?.name ?? managerUser?.name ?? null,
    managerPhone: managerContact?.phone ?? managerUser?.phone ?? null,
    managerEmail: managerContact?.email ?? managerUser?.email ?? null,
    units: units.map((u) => ({
      id: u.id, unitNumber: u.unitNumber, unitType: u.unitType, floor: u.floor, areaSqm: u.areaSqm,
      millesimes: u.millesimes, millesimesElevator: u.millesimesElevator, millesimesHeating: u.millesimesHeating,
      ownerId: u.ownerId, ownerName: u.owner?.name ?? u.owner?.email ?? null,
      residentId: u.residentId, residentName: u.resident?.name ?? u.resident?.email ?? null,
    })),
    months, issuedMonths,
  };
}

export type PeriodAllocation = {
  unitId: string; unitShare: number; ownerAmount: number; tenantAmount: number;
  ownerPaid: boolean; tenantPaid: boolean; ownerPaidAt: Date | null; tenantPaidAt: Date | null;
  ownerMethod: string | null; tenantMethod: string | null;
};
export type PeriodExpense = {
  id: string; categoryName: string; basis: StatementBasis; description: string | null;
  amount: number; net: number | null; vat: number | null; tenantPct: number; ownerPct: number;
  supplierName: string | null; documentNumber: string | null; documentDate: Date | null; paid: boolean; status: string;
  allocations: PeriodAllocation[];
};
export type Period = {
  month: string; issued: boolean;
  expenses: PeriodExpense[];
  /** One classic notice per unit (role BOTH → owner + tenant split, unit total). */
  statements: UnitStatement[];
  total: number; ownerTotal: number; tenantTotal: number;
  heating: { unitId: string; unitNumber: string; previousReading: number | null; currentReading: number | null; consumption: number | null }[];
};

/** Everything a period (issuance month) needs: expenses with per-unit allocations + per-unit statements. */
export async function loadPeriod(b: PrintBuilding, month: string): Promise<Period> {
  const [rows, overrides, heating] = await Promise.all([
    db.buildingExpense.findMany({
      where: { buildingId: b.id, status: { in: [...VISIBLE_STATUSES] }, OR: [{ issuedMonth: month }, { issuedMonth: null, month }] },
      orderBy: [{ documentDate: "asc" }, { createdAt: "asc" }],
      select: {
        id: true, category: true, description: true, supplierName: true, documentNumber: true, documentDate: true,
        amount: true, netAmount: true, vatAmount: true, tenantPct: true, ownerPct: true, paid: true, status: true, categoryId: true,
        categoryRef: { select: { name: true, defaultBasis: true } },
        allocations: { select: { unitId: true, unitShare: true, ownerAmount: true, tenantAmount: true, ownerPaid: true, tenantPaid: true, ownerPaidAt: true, tenantPaidAt: true, ownerPaymentMethod: true, tenantPaymentMethod: true } },
      },
    }),
    db.buildingCategoryOverride.findMany({ where: { buildingId: b.id }, select: { categoryId: true, distributionBasis: true } }),
    db.unitHeatingReading.findMany({ where: { unit: { buildingId: b.id }, period: month }, select: { unitId: true, previousReading: true, currentReading: true, consumption: true } }),
  ]);
  const overrideBasis = new Map(overrides.map((o) => [o.categoryId, o.distributionBasis as StatementBasis]));
  const expenses: PeriodExpense[] = rows.map((e) => ({
    id: e.id,
    categoryName: e.categoryRef?.name ?? e.category ?? "Λοιπά",
    basis: ((e.categoryId ? overrideBasis.get(e.categoryId) : null) ?? (e.categoryRef?.defaultBasis as StatementBasis | undefined) ?? "GENERAL_MILLESIMES"),
    description: e.description, amount: n(e.amount), net: e.netAmount == null ? null : n(e.netAmount), vat: e.vatAmount == null ? null : n(e.vatAmount),
    tenantPct: e.tenantPct, ownerPct: e.ownerPct, supplierName: e.supplierName, documentNumber: e.documentNumber, documentDate: e.documentDate, paid: e.paid, status: e.status,
    allocations: e.allocations.map((a) => ({
      unitId: a.unitId, unitShare: n(a.unitShare), ownerAmount: n(a.ownerAmount), tenantAmount: n(a.tenantAmount),
      ownerPaid: a.ownerPaid, tenantPaid: a.tenantPaid, ownerPaidAt: a.ownerPaidAt, tenantPaidAt: a.tenantPaidAt,
      ownerMethod: a.ownerPaymentMethod, tenantMethod: a.tenantPaymentMethod,
    })),
  }));
  const unitById = new Map(b.units.map((u) => [u.id, u]));
  const statements = b.units.map((u) => {
    const inputs: UnitStatementInput[] = [];
    for (const e of expenses) {
      const a = e.allocations.find((x) => x.unitId === u.id);
      if (!a) continue;
      inputs.push({ id: e.id, categoryName: e.categoryName, basis: e.basis, amount: e.amount, tenantPct: e.tenantPct, ownerPct: e.ownerPct, unitAmount: a.unitShare, unitTenant: a.tenantAmount, unitOwner: a.ownerAmount, description: e.description ?? e.supplierName });
    }
    return buildUnitStatement({ unitId: u.id, unitNumber: u.unitNumber, unitType: u.unitType, floor: u.floor, role: "BOTH", millesimes: u.millesimes, millesimesElevator: u.millesimesElevator, millesimesHeating: u.millesimesHeating }, inputs);
  });
  return {
    month, issued: rows.some((r) => r.status === "ISSUED"),
    expenses, statements,
    total: r2(expenses.reduce((s, e) => s + e.amount, 0)),
    ownerTotal: r2(statements.reduce((s, st) => s + st.ownerTotal, 0)),
    tenantTotal: r2(statements.reduce((s, st) => s + st.tenantTotal, 0)),
    heating: heating.map((h) => ({ unitId: h.unitId, unitNumber: unitById.get(h.unitId)?.unitNumber ?? "", previousReading: h.previousReading == null ? null : n(h.previousReading), currentReading: h.currentReading == null ? null : n(h.currentReading), consumption: h.consumption == null ? null : n(h.consumption) })),
  };
}

/** Outstanding balance per unit across ALL months except `exceptMonth` (previous dues column). */
export async function loadPriorDues(b: PrintBuilding, exceptMonth: string) {
  const rows = await db.buildingExpense.findMany({
    where: { buildingId: b.id, status: { in: [...VISIBLE_STATUSES] }, NOT: { OR: [{ issuedMonth: exceptMonth }, { issuedMonth: null, month: exceptMonth }] } },
    select: { month: true, issuedMonth: true, allocations: { select: { unitId: true, ownerAmount: true, tenantAmount: true, ownerPaid: true, tenantPaid: true } } },
  });
  const map = new Map<string, { owner: number; tenant: number; months: Set<string> }>();
  for (const e of rows) {
    const m = e.issuedMonth ?? e.month;
    if (m >= exceptMonth) continue; // only earlier periods count as "previous"
    for (const a of e.allocations) {
      const cur = map.get(a.unitId) ?? { owner: 0, tenant: 0, months: new Set<string>() };
      if (!a.ownerPaid && n(a.ownerAmount) > 0) { cur.owner += n(a.ownerAmount); cur.months.add(m); }
      if (!a.tenantPaid && n(a.tenantAmount) > 0) { cur.tenant += n(a.tenantAmount); cur.months.add(m); }
      map.set(a.unitId, cur);
    }
  }
  return new Map([...map.entries()].map(([k, v]) => [k, { owner: r2(v.owner), tenant: r2(v.tenant), months: [...v.months].sort() }]));
}

export type PrintAssembly = {
  id: string; title: string; scheduledAt: Date; status: string; minutesFinal: string | null; approvedAt: Date | null;
  participants: { displayName: string; isHost: boolean; joinedAt: Date | null; durationSeconds: number; unitNumber: string | null }[];
};
export async function loadAssembly(buildingId: string, id: string): Promise<PrintAssembly | null> {
  const a = await db.assembly.findFirst({
    where: { id, buildingId },
    select: { id: true, title: true, scheduledAt: true, status: true, minutesFinal: true, approvedAt: true, participants: { select: { displayName: true, isHost: true, joinedAt: true, durationSeconds: true, unitId: true } } },
  });
  if (!a) return null;
  const unitIds = a.participants.map((p) => p.unitId).filter((x): x is string => !!x);
  const units = unitIds.length ? await db.unit.findMany({ where: { id: { in: unitIds } }, select: { id: true, unitNumber: true } }) : [];
  const um = new Map(units.map((u) => [u.id, u.unitNumber]));
  return { ...a, participants: a.participants.map((p) => ({ displayName: p.displayName, isHost: p.isHost, joinedAt: p.joinedAt, durationSeconds: p.durationSeconds, unitNumber: p.unitId ? um.get(p.unitId) ?? null : null })) };
}
export async function listAssemblies(buildingId: string) {
  return db.assembly.findMany({ where: { buildingId }, orderBy: { scheduledAt: "desc" }, select: { id: true, title: true, scheduledAt: true, status: true, minutesFinal: true } })
    .then((rows) => rows.map((r) => ({ id: r.id, title: r.title, scheduledAt: r.scheduledAt, status: r.status, hasMinutes: !!r.minutesFinal })));
}

export type PrintAnnouncement = { id: string; title: string; content: string; audience: string; publishedAt: Date | null; createdAt: Date; senderName: string | null };
export async function loadAnnouncement(buildingId: string, id: string): Promise<PrintAnnouncement | null> {
  const a = await db.announcement.findFirst({ where: { id, buildingId }, select: { id: true, title: true, content: true, audience: true, publishedAt: true, createdAt: true, senderName: true, createdBy: { select: { name: true } } } });
  return a ? { ...a, senderName: a.senderName ?? a.createdBy?.name ?? null } : null;
}
export async function listAnnouncements(buildingId: string) {
  return db.announcement.findMany({ where: { buildingId }, orderBy: { createdAt: "desc" }, take: 30, select: { id: true, title: true, publishedAt: true, createdAt: true, status: true } });
}

/** Offers a manager can turn into a «Πρόταση δαπάνης» (customer price, VAT, subject). */
export async function listProposalSources(buildingId: string) {
  const wos = await db.workOrder.findMany({
    where: { buildingId, status: { in: ["PENDING_CUSTOMER", "ACCEPTED", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "CONFIRMED"] } },
    orderBy: { createdAt: "desc" }, take: 20,
    select: { id: true, number: true, title: true, description: true, customerPrice: true, vatPct: true, supplier: { select: { name: true } }, warrantyMonths: true, earliestDate: true },
  }).catch(() => []);
  return wos.map((w) => ({ id: w.id, number: w.number, title: w.title, description: w.description, net: n(w.customerPrice), vatPct: w.vatPct, supplierName: w.supplier.name, warrantyMonths: w.warrantyMonths, earliestDate: w.earliestDate }));
}
