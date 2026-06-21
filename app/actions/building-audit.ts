"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { auditBuilding, type AuditInput, type Finding } from "@/lib/buildings/audit";

async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const user = await db.user.findUnique({ where: { id: session.user.id as string }, select: { role: true } });
  if (user?.role !== "SUPER_ADMIN") throw new Error("Forbidden");
}

export async function auditBuildingEntries(buildingId: string): Promise<Finding[]> {
  await requireSuperAdmin();
  const building = await db.building.findUnique({
    where: { id: buildingId },
    select: {
      name: true, address: true, hasElevator: true,
      property: { select: { customer: { select: { afm: true } } } },
      units: {
        select: {
          unitNumber: true, floor: true, areaSqm: true,
          millesimes: true, millesimesElevator: true, millesimesHeating: true,
          ownerId: true, residentId: true, millesimesSource: true,
          occupancies: { where: { endDate: null }, select: { role: true } },
        },
      },
    },
  });
  if (!building) throw new Error("Δεν βρέθηκε κτήριο.");

  // Heating: does THIS building actually use metered (70/30) heating? Only a
  // building-scoped override counts — the global default basis of a category must
  // not flag buildings that don't have metered heating (avoids a false positive).
  const meteredCategoryExists =
    (await db.buildingCategoryOverride.count({
      where: { buildingId, distributionBasis: "METERED_70_30" },
    })) > 0;
  const latest = await db.unitHeatingReading.findFirst({ where: { buildingId }, orderBy: { period: "desc" }, select: { period: true } });
  const readingsForLatestPeriod = latest
    ? await db.unitHeatingReading.count({ where: { buildingId, period: latest.period, currentReading: { not: null } } })
    : 0;

  // Exclusions: count excluded units per category.
  const exclusionRows = await db.unitCategoryExclusion.groupBy({ by: ["categoryId"], where: { unit: { buildingId } }, _count: { _all: true } });
  const totalUnits = building.units.length;
  const exclusions = exclusionRows.map((r) => ({ categoryId: r.categoryId, excludedUnitCount: r._count._all, totalUnits }));

  const input: AuditInput = {
    building: { name: building.name, address: building.address, hasElevator: building.hasElevator },
    units: building.units.map((u) => ({
      unitNumber: u.unitNumber, floor: u.floor, areaSqm: u.areaSqm,
      millesimes: u.millesimes, millesimesElevator: u.millesimesElevator, millesimesHeating: u.millesimesHeating,
      ownerId: u.ownerId, residentId: u.residentId,
      hasOccupancyOwner: u.occupancies.some((o) => o.role === "OWNER"),
      hasOccupancyResident: u.occupancies.some((o) => o.role === "RESIDENT"),
      millesimesSource: u.millesimesSource,
    })),
    customer: { vat: building.property?.customer?.afm ?? null },
    heating: { meteredCategoryExists, readingsForLatestPeriod },
    exclusions,
  };
  return auditBuilding(input);
}
