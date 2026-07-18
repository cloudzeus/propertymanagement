"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { uploadFile, deleteFile, buildingFolder } from "@/lib/bunnycdn";
import { requireBuildingCap } from "@/lib/building-access";

const TYPES = ["ELECTRICITY", "OTE", "ROOF", "ANTENNA", "BOILER", "PUMP", "FIRE", "WATER", "OTHER"] as const;
export type InfraType = (typeof TYPES)[number];
export type InfraInput = {
  name: string; type: InfraType; floorLabel?: string | null; location?: string | null;
  locked?: boolean; notes?: string | null; keyHolderUserId?: string | null; accessUserIds?: string[];
};
const clean = (v?: string | null) => (v?.trim() ? v.trim() : null);

export type InfraPerson = { id: string; name: string | null; email: string; role: string; origin: "occupant" | "manager" | "staff" };

/** Candidate people for key-holder / access: building owners/residents + assigned
 *  managers + company staff (ADMIN/MANAGER/EMPLOYEE). */
export async function searchInfraPeople(buildingId: string, query: string): Promise<InfraPerson[]> {
  await requireBuildingCap(buildingId, "manageInfra");
  const b = await db.building.findUnique({ where: { id: buildingId }, select: { companyId: true, propertyId: true } });
  if (!b) return [];

  const units = await db.unit.findMany({ where: { buildingId }, select: { ownerId: true, residentId: true } });
  const occupantIds = new Set<string>();
  for (const u of units) { if (u.ownerId) occupantIds.add(u.ownerId); if (u.residentId) occupantIds.add(u.residentId); }

  const mgrs = await db.managementAssignment.findMany({
    where: { OR: [{ buildingId }, { propertyId: b.propertyId }] },
    select: { userId: true },
  });
  const managerIds = new Set(mgrs.map((m) => m.userId));

  const q = query.trim();
  const text = q ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { email: { contains: q, mode: "insensitive" as const } }] } : {};
  const users = await db.user.findMany({
    where: {
      AND: [text, { OR: [
        { id: { in: [...occupantIds, ...managerIds] } },
        { companyId: b.companyId, role: { in: ["ADMIN", "MANAGER", "EMPLOYEE"] as any } },
      ] }],
    },
    select: { id: true, name: true, email: true, role: true },
    orderBy: [{ name: "asc" }, { email: "asc" }],
    take: 30,
  });
  return users.map((u) => ({ ...u, origin: occupantIds.has(u.id) ? "occupant" : managerIds.has(u.id) ? "manager" : "staff" }));
}

export async function createInfraPoint(buildingId: string, data: InfraInput) {
  await requireBuildingCap(buildingId, "manageInfra");
  if (!data.name?.trim()) return { error: "Το όνομα είναι υποχρεωτικό" };
  const type = TYPES.includes(data.type) ? data.type : "OTHER";
  const row = await db.infraPoint.create({
    data: {
      buildingId, name: data.name.trim(), type: type as any,
      floorLabel: clean(data.floorLabel), location: clean(data.location),
      locked: !!data.locked, notes: clean(data.notes),
      keyHolderUserId: data.keyHolderUserId || null,
      access: data.accessUserIds?.length ? { create: data.accessUserIds.map((userId) => ({ userId })) } : undefined,
    },
  });
  revalidatePath(`/super-admin/buildings/${buildingId}`);
  revalidatePath(`/building/${buildingId}`);
  return { infra: row.id };
}

export async function updateInfraPoint(id: string, data: Partial<InfraInput>) {
  const existing = await db.infraPoint.findUnique({ where: { id }, select: { buildingId: true } });
  if (!existing) return { error: "Δεν βρέθηκε" };
  await requireBuildingCap(existing.buildingId, "manageInfra");
  const row = await db.infraPoint.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.type !== undefined ? { type: (TYPES.includes(data.type) ? data.type : "OTHER") as any } : {}),
      ...(data.floorLabel !== undefined ? { floorLabel: clean(data.floorLabel) } : {}),
      ...(data.location !== undefined ? { location: clean(data.location) } : {}),
      ...(data.locked !== undefined ? { locked: !!data.locked } : {}),
      ...(data.notes !== undefined ? { notes: clean(data.notes) } : {}),
      ...(data.keyHolderUserId !== undefined ? { keyHolderUserId: data.keyHolderUserId || null } : {}),
    },
    select: { buildingId: true },
  });

  if (data.accessUserIds !== undefined) {
    await db.infraAccess.deleteMany({ where: { infraPointId: id } });
    if (data.accessUserIds.length) {
      await db.infraAccess.createMany({ data: data.accessUserIds.map((userId) => ({ infraPointId: id, userId })) });
    }
  }

  revalidatePath(`/super-admin/buildings/${row.buildingId}`);
  revalidatePath(`/building/${row.buildingId}`);
  return { ok: true };
}

export async function deleteInfraPoint(id: string) {
  const row = await db.infraPoint.findUnique({ where: { id }, select: { buildingId: true } });
  if (row) await requireBuildingCap(row.buildingId, "manageInfra");
  await db.infraPoint.delete({ where: { id } });
  if (row) {
    revalidatePath(`/super-admin/buildings/${row.buildingId}`);
    revalidatePath(`/building/${row.buildingId}`);
  }
  return { ok: true };
}

/** Upload one media (image or video) for an infra point. FormData: infraPointId, file. */
export async function uploadInfraMedia(formData: FormData) {
  const infraPointId = String(formData.get("infraPointId") || "");
  const file = formData.get("file") as File | null;
  if (!infraPointId || !file) return { error: "Λείπει αρχείο" };
  const point = await db.infraPoint.findUnique({ where: { id: infraPointId }, select: { buildingId: true, building: { select: { propertyId: true } } } });
  if (!point) return { error: "Το σημείο δεν βρέθηκε" };
  await requireBuildingCap(point.buildingId, "manageInfra");
  const buffer = Buffer.from(await file.arrayBuffer());
  const safe = file.name.replace(/[^\w.\-]+/g, "_").slice(0, 100);
  const path = `${buildingFolder(point.building.propertyId, point.buildingId)}/infra/${infraPointId}/${Date.now()}-${safe}`;
  const res = await uploadFile({ path, buffer, contentType: file.type || "application/octet-stream" });
  if (!res.success || !res.url) return { error: res.error || "Αποτυχία ανεβάσματος" };
  const type = (file.type || "").startsWith("video/") ? "VIDEO" : "IMAGE";
  const row = await db.infraMedia.create({ data: { infraPointId, url: res.url, cdnPath: path, type: type as any, name: file.name } });
  revalidatePath(`/super-admin/buildings/${point.buildingId}`);
  revalidatePath(`/building/${point.buildingId}`);
  return { media: { id: row.id, url: row.url, type: row.type as "IMAGE" | "VIDEO" } };
}

export async function deleteInfraMedia(mediaId: string) {
  const m = await db.infraMedia.findUnique({ where: { id: mediaId }, select: { cdnPath: true, infraPoint: { select: { buildingId: true } } } });
  if (!m) return { error: "Δεν βρέθηκε" };
  await requireBuildingCap(m.infraPoint.buildingId, "manageInfra");
  await deleteFile(m.cdnPath);
  await db.infraMedia.delete({ where: { id: mediaId } });
  revalidatePath(`/super-admin/buildings/${m.infraPoint.buildingId}`);
  revalidatePath(`/building/${m.infraPoint.buildingId}`);
  return { ok: true };
}
