"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { distributeWeights, elevatorWeight, type WeightInput } from "@/lib/millesimes";
import { ensureFolder, buildingFolder } from "@/lib/bunnycdn";
import { requireBuildingCap } from "@/lib/building-access";
import { publishBuildingEvent } from "@/lib/realtime/bus";
import { touchBuildingDistance, recomputeBuildingDistance, getDistanceZones } from "@/lib/distance/buildings";
import { describeBuildingDistance } from "@/lib/distance/zones";
import { getEffectivePermissions, can } from "@/lib/rbac/permissions";
import { buildOnboardingPayload } from "./building-onboarding-payload";
import { duplicateUnitNumbers } from "@/lib/wizards/units-generator";

async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const user = await db.user.findUnique({ where: { id: session.user.id as string }, select: { role: true } });
  if (user?.role !== "SUPER_ADMIN") throw new Error("Forbidden");
}

async function scopeOfProperty(propertyId: string): Promise<{ companyId: string; customerId: string }> {
  const p = await db.property.findUnique({ where: { id: propertyId }, select: { companyId: true, customerId: true } });
  if (!p) throw new Error("Property not found");
  return { companyId: p.companyId, customerId: p.customerId };
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
  const { companyId, customerId } = await scopeOfProperty(propertyId);
  const building = await db.building.create({
    data: {
      companyId,
      customerId,
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

  await touchBuildingDistance(building.id);
  revalidatePath(`/super-admin/properties/${propertyId}`);
  return { building };
}

// ── Guided wizard: building + units + precomputed millesimes in one transaction ──
export type BuildingWizardInput = BuildingInput & {
  elevatorSurchargePerFloor?: number;
  elevatorExemptGroundFloor?: boolean;
  /** Common boiler → heating is a κοινόχρηστα expense (heating millesimes); false = individual heating (GAS). */
  heatingShared?: boolean;
};
export type WizardUnitInput = { unitNumber: string; floor: number | null; areaSqm: number | null; unitType: "APARTMENT" | "SHOP" | "PARKING" | "OTHER" };

/**
 * Creates a building with all its units at once (the «Κτήριο & μονάδες» wizard).
 * The three millesime sets are computed by the same pure builder the AI onboarding
 * uses (`buildOnboardingPayload`), so the wizard's example step equals what is saved.
 */
export async function createBuildingWithUnits(propertyId: string, data: BuildingWizardInput, units: WizardUnitInput[]): Promise<{ buildingId: string } | { error: string }> {
  await requireSuperAdmin();
  if (!data.name.trim()) return { error: "Το όνομα κτηρίου είναι υποχρεωτικό" };
  if (!data.address.trim()) return { error: "Η διεύθυνση είναι υποχρεωτική" };
  const clean = units.map((u) => ({ ...u, unitNumber: u.unitNumber.trim() })).filter((u) => u.unitNumber);
  if (clean.length === 0) return { error: "Προσθέστε τουλάχιστον μία μονάδα" };
  const dup = duplicateUnitNumbers(clean);
  if (dup.length) return { error: `Διπλοί αριθμοί μονάδων: ${dup.join(", ")}` };
  if (clean.length > 500) return { error: "Μέγιστο 500 μονάδες ανά κτήριο" };

  const { companyId, customerId } = await scopeOfProperty(propertyId);
  const payload = buildOnboardingPayload({
    building: {
      hasElevator: data.hasElevator ?? false,
      elevatorSurchargePerFloor: data.elevatorSurchargePerFloor ?? 0.1,
      elevatorExemptGroundFloor: data.elevatorExemptGroundFloor ?? true,
      heatingType: (data.heatingShared ?? true) ? "CENTRAL" : "GAS",
    },
    units: clean.map((u) => ({ unitNumber: u.unitNumber, floor: u.floor ?? undefined, areaSqm: u.areaSqm != null && u.areaSqm > 0 ? u.areaSqm : undefined, unitType: u.unitType })),
  });

  const buildingId = await db.$transaction(async (tx) => {
    const b = await tx.building.create({
      data: {
        companyId, customerId, propertyId,
        name: data.name.trim(), address: data.address.trim(),
        city: data.city?.trim() ?? "", postalCode: data.postalCode?.trim() ?? "", country: data.country?.trim() || "Greece",
        floors: data.floors ?? null, basements: data.basements ?? null,
        hasElevator: data.hasElevator ?? false, hasBoiler: data.hasBoiler ?? false, hasFireSafety: data.hasFireSafety ?? false,
        technicalNotes: s(data.technicalNotes), lat: data.lat ?? null, lng: data.lng ?? null,
        elevatorSurchargePerFloor: payload.building.elevatorSurchargePerFloor,
        elevatorExemptGroundFloor: payload.building.elevatorExemptGroundFloor,
      },
    });
    await tx.unit.createMany({
      data: payload.units.map((u) => ({
        buildingId: b.id, customerId, unitNumber: u.unitNumber, unitType: u.unitType, floor: u.floor, areaSqm: u.areaSqm,
        millesimes: u.millesimes, millesimesElevator: u.millesimesElevator, millesimesHeating: u.millesimesHeating,
      })),
    });
    await tx.building.update({ where: { id: b.id }, data: { unitsCount: payload.units.length } });
    return b.id;
  });

  try { await ensureFolder(buildingFolder(propertyId, buildingId)); } catch (e) { console.error("BunnyCDN folder creation failed for building", buildingId, e); }
  await touchBuildingDistance(buildingId);
  revalidatePath(`/super-admin/properties/${propertyId}`);
  revalidatePath(`/super-admin/buildings/${buildingId}`);
  revalidatePath("/super-admin/customers");
  publishBuildingEvent(buildingId, "unit");
  return { buildingId };
}

/** Re-measure one building from the base station (forces a fresh routing call). */
export async function recomputeBuildingDistanceAction(buildingId: string): Promise<{ ok: true; label: string | null } | { error: string }> {
  try {
    // Any staff role that may edit properties (ADMIN/MANAGER too), not only SUPER_ADMIN.
    const resolved = await getEffectivePermissions();
    if (!resolved || !can(resolved.perms, "properties", "edit")) return { error: "Δεν επιτρέπεται" };
    const [r, zones] = await Promise.all([recomputeBuildingDistance(buildingId, { force: true }), getDistanceZones()]);
    const b = await db.building.findUnique({ where: { id: buildingId }, select: { propertyId: true } });
    if (b) revalidatePath(`/super-admin/properties/${b.propertyId}`);
    return { ok: true, label: describeBuildingDistance(r, zones) };
  } catch (e) {
    return { error: (e as Error).message || "Αποτυχία υπολογισμού" };
  }
}

export async function updateBuilding(id: string, data: Partial<BuildingInput>) {
  await requireSuperAdmin();
  const building = await db.building.update({ where: { id }, data: buildingData(data) });
  if (data.lat !== undefined || data.lng !== undefined) await touchBuildingDistance(id);
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
  await requireBuildingCap(buildingId, "editUnits");
  if (!data.unitNumber.trim()) return { error: "Ο αριθμός μονάδας είναι υποχρεωτικός" };
  const b = await db.building.findUnique({ where: { id: buildingId }, select: { customerId: true } });
  if (!b) return { error: "Το κτήριο δεν βρέθηκε" };
  try {
    const unit = await db.unit.create({ data: { buildingId, customerId: b.customerId, ...unitData(data) } as any });
    await db.building.update({ where: { id: buildingId }, data: { unitsCount: { increment: 1 } } });
    revalidatePath(`/super-admin/properties/${await propertyOfBuilding(buildingId)}`);
    publishBuildingEvent(buildingId, "unit");
    return { unit };
  } catch {
    return { error: "Υπάρχει ήδη μονάδα με αυτόν τον αριθμό στο κτήριο" };
  }
}

export async function updateUnit(id: string, data: Partial<UnitInput>) {
  const existing = await db.unit.findUnique({ where: { id }, select: { buildingId: true } });
  if (!existing) return { error: "Η μονάδα δεν βρέθηκε" };
  await requireBuildingCap(existing.buildingId, "editUnits");
  const unit = await db.unit.update({ where: { id }, data: unitData(data) });
  revalidatePath(`/super-admin/properties/${await propertyOfBuilding(unit.buildingId)}`);
  publishBuildingEvent(unit.buildingId, "unit");
  return { unit };
}

export async function deleteUnit(id: string) {
  const u = await db.unit.findUnique({ where: { id }, select: { buildingId: true } });
  if (u) await requireBuildingCap(u.buildingId, "editUnits");
  await db.unit.delete({ where: { id } });
  if (u) {
    await db.building.update({ where: { id: u.buildingId }, data: { unitsCount: { decrement: 1 } } });
    revalidatePath(`/super-admin/properties/${await propertyOfBuilding(u.buildingId)}`);
    publishBuildingEvent(u.buildingId, "unit");
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
  await requireBuildingCap(buildingId, "editMillesimes");
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

  // Only units with at least one AUTO cell are touched; fully-MANUAL units are
  // skipped entirely so the count reflects units actually recomputed.
  const updates = units.flatMap((u) => {
    const data: Record<string, number | null> = {};
    if (u.millesimesSource === "AUTO") data.millesimes = g.get(u.id) ?? null;
    if (u.millesimesElevatorSource === "AUTO") data.millesimesElevator = e.get(u.id) ?? null;
    if (u.millesimesHeatingSource === "AUTO") data.millesimesHeating = h.get(u.id) ?? null;
    if (Object.keys(data).length === 0) return [];
    return [db.unit.update({ where: { id: u.id }, data })];
  });
  await db.$transaction(updates);
  const updated = updates.length;
  revalidatePath(`/super-admin/properties/${building.property.id}`);
  revalidatePath(`/super-admin/buildings/${buildingId}`);
  revalidatePath(`/building/${buildingId}`);
  publishBuildingEvent(buildingId, "unit");
  return { updated };
}

/** Master data of one building for the «Στοιχεία κτηρίου» modal (super-admin only — `updateBuilding` is too). */
export async function getBuildingForEdit(id: string) {
  await requireSuperAdmin();
  const b = await db.building.findUnique({
    where: { id },
    select: {
      id: true, propertyId: true, name: true, address: true, city: true, postalCode: true, country: true,
      floors: true, basements: true, hasElevator: true, hasBoiler: true, hasFireSafety: true, technicalNotes: true, lat: true, lng: true,
      property: { select: { address: true, city: true, postalCode: true, country: true, lat: true, lng: true } },
    },
  });
  if (!b) throw new Error("Building not found");
  const { property, ...building } = b;
  return { building, propertyAddress: property };
}
