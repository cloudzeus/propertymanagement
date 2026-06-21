"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const user = await db.user.findUnique({ where: { id: session.user.id as string }, select: { role: true } });
  if (user?.role !== "SUPER_ADMIN") throw new Error("Forbidden");
}

async function assertUnitInBuilding(unitId: string, buildingId: string) {
  const unit = await db.unit.findFirst({ where: { id: unitId, buildingId }, select: { id: true } });
  if (!unit) throw new Error("Η μονάδα δεν ανήκει σε αυτό το κτήριο.");
}

/** YYYY-MM of the month before `period`. */
function prevPeriod(period: string): string {
  const [y, m] = period.split("-").map(Number);
  const d = m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 };
  return `${d.y}-${String(d.m).padStart(2, "0")}`;
}

export type HeatingReadingDTO = {
  unitId: string; unitNumber: string; floor: number | null;
  previousReading: number | null; currentReading: number | null; consumption: number | null;
};

/** Units that participate in heating for this building (excluding those with a
 *  UnitCategoryExclusion against any METERED_70_30 / heating category), with this
 *  period's readings. previousReading auto-fills from the prior month's
 *  currentReading when the stored value is null. */
export async function listHeatingReadings(buildingId: string, period: string): Promise<HeatingReadingDTO[]> {
  await requireSuperAdmin();
  const heatingCatIds = (await db.expenseCategory.findMany({
    where: {
      OR: [
        { defaultBasis: "METERED_70_30" },
        { defaultBasis: "HEATING_MILLESIMES" },
        { overrides: { some: { buildingId, distributionBasis: { in: ["METERED_70_30", "HEATING_MILLESIMES"] } } } },
      ],
    },
    select: { id: true },
  })).map((c) => c.id);

  const [units, thisMonth, lastMonth] = await Promise.all([
    db.unit.findMany({
      where: { buildingId, categoryExclusions: { none: { categoryId: { in: heatingCatIds } } } },
      select: { id: true, unitNumber: true, floor: true },
      orderBy: { unitNumber: "asc" },
    }),
    db.unitHeatingReading.findMany({ where: { buildingId, period }, select: { unitId: true, previousReading: true, currentReading: true, consumption: true } }),
    db.unitHeatingReading.findMany({ where: { buildingId, period: prevPeriod(period) }, select: { unitId: true, currentReading: true } }),
  ]);

  const cur = new Map(thisMonth.map((r) => [r.unitId, r]));
  const prevCur = new Map(lastMonth.map((r) => [r.unitId, r.currentReading == null ? null : Number(r.currentReading)]));
  return units.map((u) => {
    const r = cur.get(u.id);
    const storedPrev = r?.previousReading == null ? null : Number(r.previousReading);
    return {
      unitId: u.id, unitNumber: u.unitNumber, floor: u.floor,
      previousReading: storedPrev ?? prevCur.get(u.id) ?? null,
      currentReading: r?.currentReading == null ? null : Number(r.currentReading),
      consumption: r?.consumption == null ? null : Number(r.consumption),
    };
  });
}

function consumptionOf(previous: number | null, current: number | null): number | null {
  if (current == null) return null;
  const diff = current - (previous ?? 0);
  return diff < 0 ? 0 : diff;
}

/** Upsert one unit's reading for a period. previousReading resolved from the
 *  prior month's currentReading; consumption derived. */
export async function saveHeatingReading(buildingId: string, unitId: string, period: string, currentReading: number | null) {
  await requireSuperAdmin();
  await assertUnitInBuilding(unitId, buildingId);
  const prevRow = await db.unitHeatingReading.findUnique({ where: { unitId_period: { unitId, period: prevPeriod(period) } }, select: { currentReading: true } });
  const previous = prevRow?.currentReading == null ? null : Number(prevRow.currentReading);
  const consumption = consumptionOf(previous, currentReading);
  await db.unitHeatingReading.upsert({
    where: { unitId_period: { unitId, period } },
    create: { buildingId, unitId, period, previousReading: previous, currentReading, consumption },
    update: { previousReading: previous, currentReading, consumption },
  });
  revalidatePath(`/super-admin/buildings/${buildingId}`);
  return { ok: true };
}

/** Save many readings for a period in one transaction. */
export async function bulkSaveHeatingReadings(buildingId: string, period: string, items: { unitId: string; currentReading: number | null }[]) {
  await requireSuperAdmin();
  // Verify every unit belongs to this building before stamping rows with buildingId.
  const ids = items.map((i) => i.unitId);
  const valid = new Set((await db.unit.findMany({ where: { id: { in: ids }, buildingId }, select: { id: true } })).map((u) => u.id));
  if (valid.size !== new Set(ids).size) throw new Error("Μία ή περισσότερες μονάδες δεν ανήκουν σε αυτό το κτήριο.");
  const prevRows = await db.unitHeatingReading.findMany({ where: { buildingId, period: prevPeriod(period) }, select: { unitId: true, currentReading: true } });
  const prevMap = new Map(prevRows.map((r) => [r.unitId, r.currentReading == null ? null : Number(r.currentReading)]));
  await db.$transaction(items.map((it) => {
    const previous = prevMap.get(it.unitId) ?? null;
    const consumption = consumptionOf(previous, it.currentReading);
    return db.unitHeatingReading.upsert({
      where: { unitId_period: { unitId: it.unitId, period } },
      create: { buildingId, unitId: it.unitId, period, previousReading: previous, currentReading: it.currentReading, consumption },
      update: { previousReading: previous, currentReading: it.currentReading, consumption },
    });
  }));
  revalidatePath(`/super-admin/buildings/${buildingId}`);
  return { count: items.length };
}

/** Set the building's heating meter unit label (e.g. "μονάδες"). */
export async function saveHeatingMeterUnit(buildingId: string, label: string | null) {
  await requireSuperAdmin();
  await db.building.update({ where: { id: buildingId }, data: { heatingMeterUnit: label } });
  revalidatePath(`/super-admin/buildings/${buildingId}`);
  return { ok: true };
}
