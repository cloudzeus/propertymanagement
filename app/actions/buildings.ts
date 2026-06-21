"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { distributeWeights, elevatorWeight, type WeightInput } from "@/lib/millesimes";
import { ensureFolder, buildingFolder } from "@/lib/bunnycdn";

async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const user = await db.user.findUnique({ where: { id: session.user.id as string }, select: { role: true } });
  if (user?.role !== "SUPER_ADMIN") throw new Error("Forbidden");
}

async function companyOfProperty(propertyId: string): Promise<string> {
  const p = await db.property.findUnique({ where: { id: propertyId }, select: { companyId: true } });
  if (!p) throw new Error("Property not found");
  return p.companyId;
}

const s = (v?: string | null) => (v?.trim() || null);

// ── Buildings ────────────────────────────────────────────────────────────────
export type BuildingInput = {
  name: string;
  address: string;
  city?: string | null;
  postalCode?: string | null;
  country?: string | null;
  floors?: number | null;
  basements?: number | null;
  hasElevator?: boolean;
  hasBoiler?: boolean;
  hasFireSafety?: boolean;
  technicalNotes?: string | null;
  lat?: number | null;
  lng?: number | null;
};

function buildingData(d: Partial<BuildingInput>) {
  return {
    ...(d.name !== undefined ? { name: d.name.trim() } : {}),
    ...(d.address !== undefined ? { address: d.address.trim() } : {}),
    ...(d.city !== undefined ? { city: d.city?.trim() ?? "" } : {}),
    ...(d.postalCode !== undefined ? { postalCode: d.postalCode?.trim() ?? "" } : {}),
    ...(d.country !== undefined ? { country: d.country?.trim() || "Greece" } : {}),
    ...(d.floors !== undefined ? { floors: d.floors } : {}),
    ...(d.basements !== undefined ? { basements: d.basements } : {}),
    ...(d.hasElevator !== undefined ? { hasElevator: d.hasElevator } : {}),
    ...(d.hasBoiler !== undefined ? { hasBoiler: d.hasBoiler } : {}),
    ...(d.hasFireSafety !== undefined ? { hasFireSafety: d.hasFireSafety } : {}),
    ...(d.technicalNotes !== undefined ? { technicalNotes: s(d.technicalNotes) } : {}),
    ...(d.lat !== undefined ? { lat: d.lat } : {}),
    ...(d.lng !== undefined ? { lng: d.lng } : {}),
  };
}

export async function createBuilding(propertyId: string, data: BuildingInput) {
  await requireSuperAdmin();
  if (!data.name.trim()) return { error: "Το όνομα κτηρίου είναι υποχρεωτικό" };
  const building = await db.building.create({
    data: {
      companyId: await companyOfProperty(propertyId),
      propertyId,
      name: data.name.trim(),
      address: data.address.trim(),
      city: data.city?.trim() ?? "",
      postalCode: data.postalCode?.trim() ?? "",
      country: data.country?.trim() || "Greece",
      floors: data.floors ?? null,
      basements: data.basements ?? null,
      hasElevator: data.hasElevator ?? false,
      hasBoiler: data.hasBoiler ?? false,
      hasFireSafety: data.hasFireSafety ?? false,
      technicalNotes: s(data.technicalNotes),
      lat: data.lat ?? null,
      lng: data.lng ?? null,
    },
  });

  // Best-effort BunnyCDN folder for this building's files.
  try {
    await ensureFolder(buildingFolder(propertyId, building.id));
  } catch (e) {
    console.error("BunnyCDN folder creation failed for building", building.id, e);
  }

  revalidatePath(`/super-admin/properties/${propertyId}`);
  return { building };
}

export async function updateBuilding(id: string, data: Partial<BuildingInput>) {
  await requireSuperAdmin();
  const building = await db.building.update({ where: { id }, data: buildingData(data) });
  revalidatePath(`/super-admin/properties/${building.propertyId}`);
  return { building };
}

export async function deleteBuilding(id: string) {
  await requireSuperAdmin();
  const b = await db.building.findUnique({ where: { id }, select: { propertyId: true, _count: { select: { units: true } } } });
  if (b && b._count.units > 0) return { error: "Το κτήριο έχει μονάδες — διαγράψτε τες πρώτα" };
  await db.building.delete({ where: { id } });
  if (b) revalidatePath(`/super-admin/properties/${b.propertyId}`);
  return { success: true };
}

// ── Units ────────────────────────────────────────────────────────────────────
export type UnitInput = {
  unitNumber: string;
  unitType: "APARTMENT" | "SHOP" | "PARKING" | "OTHER";
  floor?: number | null;
  areaSqm?: number | null;
  millesimes?: number | null;
};

function unitData(d: Partial<UnitInput>) {
  return {
    ...(d.unitNumber !== undefined ? { unitNumber: d.unitNumber.trim() } : {}),
    ...(d.unitType !== undefined ? { unitType: d.unitType as any } : {}),
    ...(d.floor !== undefined ? { floor: d.floor } : {}),
    ...(d.areaSqm !== undefined ? { areaSqm: d.areaSqm } : {}),
    ...(d.millesimes !== undefined ? { millesimes: d.millesimes } : {}),
  };
}

async function propertyOfBuilding(buildingId: string): Promise<string> {
  const b = await db.building.findUnique({ where: { id: buildingId }, select: { propertyId: true } });
  if (!b) throw new Error("Building not found");
  return b.propertyId;
}

export async function createUnit(buildingId: string, data: UnitInput) {
  await requireSuperAdmin();
  if (!data.unitNumber.trim()) return { error: "Ο αριθμός μονάδας είναι υποχρεωτικός" };
  try {
    const unit = await db.unit.create({ data: { buildingId, ...unitData(data) } as any });
    await db.building.update({ where: { id: buildingId }, data: { unitsCount: { increment: 1 } } });
    revalidatePath(`/super-admin/properties/${await propertyOfBuilding(buildingId)}`);
    return { unit };
  } catch {
    return { error: "Υπάρχει ήδη μονάδα με αυτόν τον αριθμό στο κτήριο" };
  }
}

export async function updateUnit(id: string, data: Partial<UnitInput>) {
  await requireSuperAdmin();
  const unit = await db.unit.update({ where: { id }, data: unitData(data) });
  revalidatePath(`/super-admin/properties/${await propertyOfBuilding(unit.buildingId)}`);
  return { unit };
}

export async function deleteUnit(id: string) {
  await requireSuperAdmin();
  const u = await db.unit.findUnique({ where: { id }, select: { buildingId: true } });
  await db.unit.delete({ where: { id } });
  if (u) {
    await db.building.update({ where: { id: u.buildingId }, data: { unitsCount: { decrement: 1 } } });
    revalidatePath(`/super-admin/properties/${await propertyOfBuilding(u.buildingId)}`);
  }
  return { success: true };
}

// ── Common areas ─────────────────────────────────────────────────────────────
export async function createCommonArea(buildingId: string, data: { name: string; type?: string | null; floor?: number | null }) {
  await requireSuperAdmin();
  if (!data.name.trim()) return { error: "Το όνομα είναι υποχρεωτικό" };
  const area = await db.commonArea.create({ data: { buildingId, name: data.name.trim(), type: s(data.type), floor: data.floor ?? null } });
  revalidatePath(`/super-admin/properties/${await propertyOfBuilding(buildingId)}`);
  return { area };
}

export async function deleteCommonArea(id: string) {
  await requireSuperAdmin();
  const a = await db.commonArea.findUnique({ where: { id }, select: { buildingId: true } });
  await db.commonArea.delete({ where: { id } });
  if (a) revalidatePath(`/super-admin/properties/${await propertyOfBuilding(a.buildingId)}`);
  return { success: true };
}

/** Auto-distribute the 3 χιλιοστά sets across a building's units. Each set is
 *  recomputed from its AUTO cells; MANUAL-locked cells keep their stored value. */
export async function recalculateMillesimes(buildingId: string) {
  await requireSuperAdmin();
  const building = await db.building.findUnique({
    where: { id: buildingId },
    select: {
      property: { select: { id: true } },
      elevatorSurchargePerFloor: true,
      elevatorExemptGroundFloor: true,
      units: {
        select: {
          id: true,
          areaSqm: true,
          floor: true,
          millesimesSource: true,
          millesimesElevatorSource: true,
          millesimesHeatingSource: true,
        },
      },
    },
  });
  if (!building) return { error: "Το κτήριο δεν βρέθηκε" };
  const units = building.units;
  if (!units.some((u) => u.areaSqm != null && u.areaSqm > 0)) {
    return { error: "Καμία μονάδα δεν έχει τετραγωνικά για υπολογισμό" };
  }

  // Each set computed from AUTO cells; MANUAL cells keep their stored value.
  const general = distributeWeights(units.map((u) => ({ id: u.id, weight: u.areaSqm ?? 0 })));
  const elevator = distributeWeights(
    units.map((u): WeightInput => ({
      id: u.id,
      weight: elevatorWeight(
        u.areaSqm ?? 0,
        u.floor,
        building.elevatorSurchargePerFloor,
        building.elevatorExemptGroundFloor,
      ),
    })),
  );
  const heating = distributeWeights(units.map((u) => ({ id: u.id, weight: u.areaSqm ?? 0 })));
  const byId = (arr: { id: string; value: number | null }[]) =>
    new Map(arr.map((r) => [r.id, r.value]));
  const g = byId(general),
    e = byId(elevator),
    h = byId(heating);

  let updated = 0;
  await db.$transaction(
    units.map((u) => {
      const data: Record<string, number | null> = {};
      if (u.millesimesSource === "AUTO") data.millesimes = g.get(u.id) ?? null;
      if (u.millesimesElevatorSource === "AUTO") data.millesimesElevator = e.get(u.id) ?? null;
      if (u.millesimesHeatingSource === "AUTO") data.millesimesHeating = h.get(u.id) ?? null;
      updated++;
      return db.unit.update({ where: { id: u.id }, data });
    }),
  );
  revalidatePath(`/super-admin/properties/${building.property.id}`);
  revalidatePath(`/super-admin/buildings/${buildingId}`);
  return { updated };
}
