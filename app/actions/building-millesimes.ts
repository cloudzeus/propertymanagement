"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { MillesimeSource, type DistributionBasis } from "@/lib/prisma/enums";
import { requireBuildingCap } from "@/lib/building-access";
import { publishBuildingEvent } from "@/lib/realtime/bus";
import { generalSet, elevatorSet, heatingSet, manualSumError, type MillesimesPlan } from "@/lib/wizards/examples/millesimes";

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

// ── Guided wizard: all three sets + elevator params + heating basis in one transaction ──
export type { MillesimesPlan };

/**
 * Applies the «Χιλιοστά βήμα-βήμα» plan: general / elevator / heating sets (AUTO →
 * computed from τ.μ./ορόφους with source AUTO; manual → stored with source MANUAL),
 * the building's elevator parameters, and the heating distribution basis (override
 * on the heating expense category, as the AI onboarding does for METERED_70_30).
 */
export async function applyMillesimesSetup(buildingId: string, plan: MillesimesPlan): Promise<{ ok: true; updated: number } | { error: string }> {
  await requireBuildingCap(buildingId, "editMillesimes");
  const building = await db.building.findUnique({ where: { id: buildingId }, select: { id: true, propertyId: true, units: { select: { id: true, unitNumber: true, areaSqm: true, floor: true } } } });
  if (!building) return { error: "Το κτήριο δεν βρέθηκε" };
  const units = building.units;
  if (units.length === 0) return { error: "Το κτήριο δεν έχει μονάδες" };
  const ids = new Set(units.map((u) => u.id));

  for (const [label, cells] of [["γενικά", plan.general === "AUTO" ? null : plan.general], ["ανελκυστήρα", plan.elevator.enabled ? plan.elevator.manual : null], ["θέρμανσης", plan.heating.basis === "NONE" ? null : plan.heating.manual]] as const) {
    if (!cells) continue;
    if (cells.some((c) => !ids.has(c.unitId))) return { error: "Μονάδα εκτός κτηρίου" };
    const err = manualSumError(cells);
    if (err) return { error: `Χιλιοστά ${label}: ${err}` };
  }

  const g = generalSet(units, plan), e = elevatorSet(units, plan), h = heatingSet(units, plan);
  const manualG = plan.general === "AUTO" ? null : plan.general;
  const manualE = plan.elevator.enabled ? plan.elevator.manual : null;
  const manualH = plan.heating.basis === "NONE" ? null : plan.heating.manual;

  await db.$transaction(async (tx) => {
    await tx.building.update({ where: { id: buildingId }, data: { elevatorSurchargePerFloor: plan.elevator.surchargePerFloor, elevatorExemptGroundFloor: plan.elevator.exemptGroundFloor } });
    for (const u of units) {
      await tx.unit.update({
        where: { id: u.id },
        data: {
          millesimes: g.get(u.id) ?? null, millesimesSource: manualG ? MillesimeSource.MANUAL : MillesimeSource.AUTO,
          millesimesElevator: e.get(u.id) ?? null, millesimesElevatorSource: manualE ? MillesimeSource.MANUAL : MillesimeSource.AUTO,
          millesimesHeating: h.get(u.id) ?? null, millesimesHeatingSource: manualH ? MillesimeSource.MANUAL : MillesimeSource.AUTO,
        },
      });
    }
    // Heating basis: an override on the heating category (METERED_70_30 / EQUAL_PER_UNIT); the category default otherwise.
    const heatingCat = await tx.expenseCategory.findFirst({ where: { defaultBasis: { in: ["HEATING_MILLESIMES", "METERED_70_30"] } }, select: { id: true, defaultTenantPct: true, defaultOwnerPct: true } });
    if (heatingCat) {
      if (plan.heating.basis === "METERED_70_30" || plan.heating.basis === "EQUAL_PER_UNIT") {
        await tx.buildingCategoryOverride.upsert({
          where: { buildingId_categoryId: { buildingId, categoryId: heatingCat.id } },
          create: { buildingId, categoryId: heatingCat.id, distributionBasis: plan.heating.basis, tenantPct: heatingCat.defaultTenantPct, ownerPct: heatingCat.defaultOwnerPct },
          update: { distributionBasis: plan.heating.basis },
        });
      } else {
        await tx.buildingCategoryOverride.deleteMany({ where: { buildingId, categoryId: heatingCat.id, distributionBasis: { not: null } } });
      }
    }
  });

  revalidatePath(`/super-admin/properties/${building.propertyId}`);
  revalidatePath(`/super-admin/buildings/${buildingId}`);
  revalidatePath(`/building/${buildingId}`);
  publishBuildingEvent(buildingId, "unit");
  return { ok: true, updated: units.length };
}
