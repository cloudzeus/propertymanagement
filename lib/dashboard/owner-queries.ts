import { db } from "@/lib/db";
import { type AllocRow } from "./alloc-view";

export async function getOwnerUnits(userId: string) {
  return db.unit.findMany({
    where: { ownerId: userId },
    orderBy: [{ building: { name: "asc" } }, { unitNumber: "asc" }],
    select: {
      id: true, unitNumber: true, unitType: true, floor: true, areaSqm: true, millesimes: true,
      residentId: true,
      resident: { select: { name: true, email: true } },
      building: { select: { id: true, name: true, address: true, city: true } },
      occupancies: {
        orderBy: { startDate: "desc" },
        select: { id: true, role: true, startDate: true, endDate: true, user: { select: { name: true, email: true } } },
      },
    },
  });
}

export async function getOwnerAllocRows(userId: string): Promise<AllocRow[]> {
  const allocs = await db.expenseAllocation.findMany({
    where: { unit: { ownerId: userId } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, ownerAmount: true, ownerPaid: true,
      unit: { select: { unitNumber: true, building: { select: { name: true } } } },
      expense: { select: { month: true, description: true, receiptFile: { select: { url: true } } } },
    },
  });
  return allocs.map((a) => ({
    id: a.id, month: a.expense.month,
    unitLabel: `${a.unit.building.name} · ${a.unit.unitNumber}`,
    description: a.expense.description,
    amount: Number(a.ownerAmount), paid: a.ownerPaid,
    receiptUrl: a.expense.receiptFile?.url ?? null,
  }));
}

export async function getOwnerBuildingIds(userId: string): Promise<string[]> {
  const units = await db.unit.findMany({ where: { ownerId: userId }, select: { buildingId: true } });
  return [...new Set(units.map((u) => u.buildingId))];
}

export const PUBLIC_FILE_CATEGORIES = ["PLANS", "PHOTOS", "DOCUMENTS", "CERTIFICATES", "OTHER"] as const;

export async function getOwnerAnnouncementsAndFiles(userId: string) {
  const buildingIds = await getOwnerBuildingIds(userId);
  const [announcements, files] = await Promise.all([
    db.announcement.findMany({
      where: { buildingId: { in: buildingIds }, status: "ACTIVE", audience: { in: ["ALL", "OWNERS"] } },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, content: true, imageUrl: true, createdAt: true, building: { select: { name: true } } },
    }),
    db.buildingFile.findMany({
      where: { buildingId: { in: buildingIds }, category: { in: [...PUBLIC_FILE_CATEGORIES] } },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, url: true, category: true, mimeType: true, sizeBytes: true, createdAt: true, building: { select: { name: true } } },
    }),
  ]);
  return { announcements, files };
}

export async function getOwnerRequests(userId: string) {
  return db.maintenanceRequest.findMany({
    where: { unit: { ownerId: userId } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, title: true, status: true, priority: true, createdAt: true,
      unit: { select: { unitNumber: true } }, building: { select: { name: true } },
      categoryRef: { select: { name: true } },
    },
  });
}

export type TenancyState = "SELF" | "RENTED" | "VACANT";

export async function getOwnerPortfolio(userId: string) {
  const units = await db.unit.findMany({
    where: { ownerId: userId },
    orderBy: [{ building: { name: "asc" } }, { unitNumber: "asc" }],
    select: {
      id: true, unitNumber: true, floor: true, areaSqm: true, millesimes: true, residentId: true,
      resident: { select: { name: true, email: true } },
      building: { select: { id: true, name: true } },
      expenseAllocations: { where: { ownerPaid: false }, select: { ownerAmount: true } },
    },
  });
  return units.map((u) => ({
    id: u.id, unitNumber: u.unitNumber, floor: u.floor, areaSqm: u.areaSqm,
    millesimes: u.millesimes, buildingId: u.building.id, buildingName: u.building.name,
    tenancy: (u.residentId === userId ? "SELF" : u.residentId ? "RENTED" : "VACANT") as TenancyState,
    tenantName: u.residentId && u.residentId !== userId ? (u.resident?.name ?? u.resident?.email ?? null) : null,
    unpaidOwner: u.expenseAllocations.reduce((s, a) => s + Number(a.ownerAmount), 0),
  }));
}

export async function getTenantSide(userId: string) {
  const unit = await db.unit.findFirst({
    where: { residentId: userId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true, unitNumber: true, ownerId: true, buildingId: true,
      building: { select: { name: true } },
      expenseAllocations: {
        select: { tenantAmount: true, tenantPaid: true, expense: { select: { month: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!unit) return null;
  const unpaid = unit.expenseAllocations.reduce((s, a) => s + (a.tenantPaid ? 0 : Number(a.tenantAmount)), 0);
  return {
    unitNumber: unit.unitNumber, buildingName: unit.building.name, buildingId: unit.buildingId,
    // Self-occupancy is a real tenant-side obligation (the owner pays the tenant
    // share of their own unit) — the flag only drives the wording upstream.
    selfOwned: unit.ownerId === userId,
    unpaidTenant: unpaid, latestMonth: unit.expenseAllocations[0]?.expense.month ?? null,
  };
}

const BASIS_LABEL: Record<string, string> = {
  GENERAL_MILLESIMES: "Γενικά χιλιοστά",
  ELEVATOR_MILLESIMES: "Χιλιοστά ανελκυστήρα",
  HEATING_MILLESIMES: "Χιλιοστά θέρμανσης",
  EQUAL_PER_UNIT: "Ισομερώς ανά μονάδα",
  METERED_70_30: "Μετρητής θέρμανσης (70/30)",
};

export type BillingExplainerBuilding = {
  buildingId: string;
  buildingName: string;
  params: {
    floors: number | null;
    basements: number | null;
    hasElevator: boolean;
    elevatorSurchargePerFloor: number;
    elevatorExemptGroundFloor: boolean;
    heatingMeterUnit: string | null;
  };
  categories: { id: string; name: string; basis: string; basisLabel: string }[];
  myUnits: {
    unitNumber: string;
    millesimes: number | null;
    millesimesElevator: number | null;
    millesimesHeating: number | null;
  }[];
};

export async function getOwnerBillingExplainer(userId: string): Promise<BillingExplainerBuilding[]> {
  const units = await db.unit.findMany({
    where: { ownerId: userId },
    orderBy: [{ building: { name: "asc" } }, { unitNumber: "asc" }],
    select: {
      unitNumber: true, millesimes: true, millesimesElevator: true, millesimesHeating: true,
      building: {
        select: {
          id: true, name: true, floors: true, basements: true, hasElevator: true,
          elevatorSurchargePerFloor: true, elevatorExemptGroundFloor: true, heatingMeterUnit: true,
        },
      },
    },
  });
  if (units.length === 0) return [];

  const buildingIds = [...new Set(units.map((u) => u.building.id))];
  const [categories, overrides] = await Promise.all([
    db.expenseCategory.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, defaultBasis: true },
    }),
    db.buildingCategoryOverride.findMany({
      where: { buildingId: { in: buildingIds }, distributionBasis: { not: null } },
      select: { buildingId: true, categoryId: true, distributionBasis: true },
    }),
  ]);

  return buildingIds.map((bid) => {
    const b = units.find((u) => u.building.id === bid)!.building;
    const bOverrides = new Map(
      overrides.filter((o) => o.buildingId === bid).map((o) => [o.categoryId, o.distributionBasis!]),
    );
    return {
      buildingId: b.id,
      buildingName: b.name,
      params: {
        floors: b.floors,
        basements: b.basements,
        hasElevator: b.hasElevator,
        elevatorSurchargePerFloor: Number(b.elevatorSurchargePerFloor),
        elevatorExemptGroundFloor: b.elevatorExemptGroundFloor,
        heatingMeterUnit: b.heatingMeterUnit,
      },
      categories: categories.map((c) => {
        const basis = (bOverrides.get(c.id) ?? c.defaultBasis) as string;
        return { id: c.id, name: c.name, basis, basisLabel: BASIS_LABEL[basis] ?? basis };
      }),
      myUnits: units
        .filter((u) => u.building.id === bid)
        .map((u) => ({
          unitNumber: u.unitNumber,
          millesimes: u.millesimes,
          millesimesElevator: u.millesimesElevator,
          millesimesHeating: u.millesimesHeating,
        })),
    };
  });
}

export async function getOwnerDuoRows(userId: string) {
  const [ownerAllocs, tenantAllocs] = await Promise.all([
    db.expenseAllocation.findMany({
      where: { unit: { ownerId: userId } },
      select: { ownerAmount: true, expense: { select: { month: true } } },
    }),
    db.expenseAllocation.findMany({
      where: { unit: { residentId: userId } },
      select: { tenantAmount: true, expense: { select: { month: true } } },
    }),
  ]);
  return [
    ...ownerAllocs.map((a) => ({ month: a.expense.month, owner: Number(a.ownerAmount), tenant: 0 })),
    ...tenantAllocs.map((a) => ({ month: a.expense.month, owner: 0, tenant: Number(a.tenantAmount) })),
  ];
}
