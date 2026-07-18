"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { MillesimeSource, type DistributionBasis } from "@/lib/prisma/enums";
import { requireBuildingCap } from "@/lib/building-access";

/** Guard that a unit actually belongs to the given building before mutating it,
 *  so a mismatched client-supplied id can't write across buildings. */
async function assertUnitInBuilding(unitId: string, buildingId: string) {
  const unit = await db.unit.findFirst({ where: { id: unitId, buildingId }, select: { id: true } });
  if (!unit) throw new Error("Η μονάδα δεν ανήκει σε αυτό το κτήριο.");
}

type SetKey = "general" | "elevator" | "heating";

/** Save one millesime cell. A non-null value locks it (MANUAL); passing
 *  reset=true returns the cell to AUTO (value recomputed later by recalc). */
export async function saveMillesimeCell(
  buildingId: string,
  unitId: string,
  set: SetKey,
  value: number | null,
  reset = false,
) {
  await requireBuildingCap(buildingId, "editMillesimes");
  await assertUnitInBuilding(unitId, buildingId);
  const field = set === "elevator" ? "millesimesElevator" : set === "heating" ? "millesimesHeating" : "millesimes";
  const sourceField = set === "elevator" ? "millesimesElevatorSource" : set === "heating" ? "millesimesHeatingSource" : "millesimesSource";
  const data: Record<string, unknown> = reset
    ? { [sourceField]: MillesimeSource.AUTO }
    : { [field]: value, [sourceField]: MillesimeSource.MANUAL };
  await db.unit.update({ where: { id: unitId }, data });
  revalidatePath(`/super-admin/buildings/${buildingId}`);
  revalidatePath(`/building/${buildingId}`);
  return { ok: true };
}

/** Set or clear the building's distribution-method override for a category.
 *  basis=null removes the override (falls back to the category default). */
export async function setCategoryBasis(buildingId: string, categoryId: string, basis: DistributionBasis | null) {
  await requireBuildingCap(buildingId, "editDistribution");
  if (basis === null) {
    await db.buildingCategoryOverride.deleteMany({ where: { buildingId, categoryId } });
  } else {
    const existing = await db.buildingCategoryOverride.findUnique({ where: { buildingId_categoryId: { buildingId, categoryId } } });
    if (existing) {
      await db.buildingCategoryOverride.update({ where: { buildingId_categoryId: { buildingId, categoryId } }, data: { distributionBasis: basis } });
    } else {
      const cat = await db.expenseCategory.findUnique({ where: { id: categoryId }, select: { defaultTenantPct: true, defaultOwnerPct: true } });
      await db.buildingCategoryOverride.create({ data: { buildingId, categoryId, distributionBasis: basis, tenantPct: cat?.defaultTenantPct ?? 0, ownerPct: cat?.defaultOwnerPct ?? 100 } });
    }
  }
  revalidatePath(`/super-admin/buildings/${buildingId}`);
  revalidatePath(`/building/${buildingId}`);
  return { ok: true };
}

/** Toggle a unit×category exclusion. excluded=true → row exists (unit does NOT
 *  pay); false → row removed (unit pays, the default). */
export async function setUnitCategoryExclusion(buildingId: string, unitId: string, categoryId: string, excluded: boolean) {
  await requireBuildingCap(buildingId, "editDistribution");
  await assertUnitInBuilding(unitId, buildingId);
  if (excluded) {
    await db.unitCategoryExclusion.upsert({
      where: { unitId_categoryId: { unitId, categoryId } },
      create: { unitId, categoryId },
      update: {},
    });
  } else {
    await db.unitCategoryExclusion.deleteMany({ where: { unitId, categoryId } });
  }
  revalidatePath(`/super-admin/buildings/${buildingId}`);
  revalidatePath(`/building/${buildingId}`);
  return { ok: true };
}

/** Save building-level elevator parameters. */
export async function saveElevatorParams(buildingId: string, surchargePerFloor: number, exemptGroundFloor: boolean) {
  await requireBuildingCap(buildingId, "editMillesimes");
  await db.building.update({ where: { id: buildingId }, data: { elevatorSurchargePerFloor: surchargePerFloor, elevatorExemptGroundFloor: exemptGroundFloor } });
  revalidatePath(`/super-admin/buildings/${buildingId}`);
  revalidatePath(`/building/${buildingId}`);
  return { ok: true };
}
