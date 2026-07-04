import { db } from "@/lib/db";
import { lastNMonths, monthlyTrend, occupancy, collectionRate } from "./aggregations";
import type { PropertyMarker } from "@/components/maps/PropertiesMap";

/** Properties for the dashboard map tab: markers (with building-coord fallback)
 *  plus the names of properties that still have no location. */
export async function getPropertiesForMap(): Promise<{ markers: PropertyMarker[]; missing: string[] }> {
  const rows = await db.property.findMany({
    select: {
      id: true, name: true, lat: true, lng: true, city: true,
      customer: { select: { name: true } },
      buildings: { select: { lat: true, lng: true }, where: { lat: { not: null }, lng: { not: null } }, take: 1 },
    },
    orderBy: { name: "asc" },
  });
  const markers: PropertyMarker[] = [];
  const missing: string[] = [];
  for (const r of rows) {
    // Fall back to a geocoded building when the property itself has no coordinates.
    const lat = r.lat ?? r.buildings[0]?.lat ?? null;
    const lng = r.lng ?? r.buildings[0]?.lng ?? null;
    if (lat != null && lng != null) {
      markers.push({ id: r.id, name: r.name, lat, lng, city: r.city, customerName: r.customer.name });
    } else {
      missing.push(r.name);
    }
  }
  return { markers, missing };
}

function anchorMonth(): string {
  // UTC to stay consistent with lastNMonths() which builds the series in UTC.
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
const OPEN = ["OPEN", "IN_PROGRESS"];

export async function getOwnerDashboard(userId: string) {
  const months = lastNMonths(anchorMonth(), 6);
  const [units, allocations, tickets] = await Promise.all([
    db.unit.findMany({ where: { ownerId: userId }, include: { building: true }, orderBy: { createdAt: "desc" } }),
    db.expenseAllocation.findMany({
      where: { unit: { ownerId: userId } },
      include: { expense: { select: { month: true } } },
    }),
    db.maintenanceRequest.findMany({
      where: { unit: { ownerId: userId }, status: { in: OPEN } },
      orderBy: { createdAt: "desc" }, take: 6,
    }),
  ]);
  const occ = occupancy(units.map((u) => ({ residentId: u.residentId })));
  const owed = allocations.reduce((s, a) => (a.ownerPaid ? s : s + Number(a.ownerAmount)), 0);
  const trend = monthlyTrend(
    allocations.map((a) => ({ month: a.expense.month, amount: Number(a.ownerAmount) })),
    months,
  );
  return { units, occ, owed, trend, tickets };
}

export async function getResidentDashboard(userId: string, companyId?: string) {
  const months = lastNMonths(anchorMonth(), 6);
  // Data isolation: a resident only sees announcements for their own building(s).
  const residentUnits = await db.unit.findMany({ where: { residentId: userId }, select: { buildingId: true } });
  const buildingIds = [...new Set(residentUnits.map((u) => u.buildingId))];
  const [unit, allocations, tickets, announcements] = await Promise.all([
    db.unit.findFirst({ where: { residentId: userId }, include: { building: true } }),
    db.expenseAllocation.findMany({
      where: { unit: { residentId: userId } },
      include: { expense: { select: { month: true, description: true } } },
      orderBy: { createdAt: "desc" },
    }),
    db.maintenanceRequest.findMany({
      where: { reportedById: userId, status: { in: OPEN } },
      orderBy: { createdAt: "desc" }, take: 6,
    }),
    db.announcement.findMany({
      where: { buildingId: { in: buildingIds }, status: "ACTIVE" },
      orderBy: { createdAt: "desc" }, take: 5,
    }),
  ]);
  const balance = allocations.reduce((s, a) => (a.tenantPaid ? s : s + Number(a.tenantAmount)), 0);
  const trend = monthlyTrend(
    allocations.map((a) => ({ month: a.expense.month, amount: Number(a.tenantAmount) })),
    months,
  );
  return { unit, allocations, balance, trend, tickets, announcements };
}

/** Building IDs this PROPERTY_ADMIN manages (building- or property-level assignments). */
async function managedBuildingIds(userId: string): Promise<string[]> {
  const assignments = await db.managementAssignment.findMany({
    where: { userId },
    select: { buildingId: true, propertyId: true },
  });
  const direct = assignments.map((a) => a.buildingId).filter((x): x is string => !!x);
  const propertyIds = assignments.map((a) => a.propertyId).filter((x): x is string => !!x);
  let viaProperty: string[] = [];
  if (propertyIds.length) {
    const bs = await db.building.findMany({ where: { propertyId: { in: propertyIds } }, select: { id: true } });
    viaProperty = bs.map((b) => b.id);
  }
  return Array.from(new Set([...direct, ...viaProperty]));
}

export async function getBuildingManagerDashboard(userId: string) {
  const months = lastNMonths(anchorMonth(), 6);
  const month = anchorMonth();
  const buildingIds = await managedBuildingIds(userId);
  const where = { buildingId: { in: buildingIds } };
  const buildingIdFilter = { id: { in: buildingIds } };

  const [buildings, monthAllocations, allAllocations, expenses, tickets, announcements] = await Promise.all([
    db.building.findMany({ where: buildingIdFilter }),
    db.expenseAllocation.findMany({
      where: { unit: { building: buildingIdFilter }, expense: { month } },
      include: { unit: { select: { unitNumber: true } }, expense: { select: { month: true } } },
    }),
    db.expenseAllocation.findMany({
      where: { unit: { building: buildingIdFilter } },
      include: { expense: { select: { month: true } } },
    }),
    db.buildingExpense.findMany({ where: { ...where, month }, orderBy: { createdAt: "desc" }, take: 6 }),
    db.maintenanceRequest.findMany({ where: { ...where, status: { in: OPEN } }, orderBy: { createdAt: "desc" }, take: 6 }),
    db.announcement.findMany({ where: { building: buildingIdFilter, status: "ACTIVE" }, orderBy: { createdAt: "desc" }, take: 4 }),
  ]);

  const totalMonth = monthAllocations.reduce((s, a) => s + Number(a.tenantAmount) + Number(a.ownerAmount), 0);
  const collectedMonth = monthAllocations.reduce(
    (s, a) => s + (a.tenantPaid ? Number(a.tenantAmount) : 0) + (a.ownerPaid ? Number(a.ownerAmount) : 0), 0);
  const collection = collectionRate(collectedMonth, totalMonth);
  const debtors = monthAllocations.filter((a) => !a.tenantPaid || !a.ownerPaid);
  const debtorAmount = debtors.reduce(
    (s, a) => s + (a.tenantPaid ? 0 : Number(a.tenantAmount)) + (a.ownerPaid ? 0 : Number(a.ownerAmount)), 0);
  const expensesTotal = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const trend = monthlyTrend(
    allAllocations
      .filter((a) => a.tenantPaid || a.ownerPaid)
      .map((a) => ({ month: a.expense.month, amount: (a.tenantPaid ? Number(a.tenantAmount) : 0) + (a.ownerPaid ? Number(a.ownerAmount) : 0) })),
    months,
  );
  return { buildings, monthAllocations, collection, debtors, debtorAmount, expenses, expensesTotal, trend, tickets, announcements };
}
