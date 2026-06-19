"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { uploadFile, buildingFolder } from "@/lib/bunnycdn";

async function requireStaff() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const u = await db.user.findUnique({ where: { id: session.user.id as string }, select: { role: true } });
  if (!["SUPER_ADMIN", "ADMIN", "MANAGER", "PROPERTY_ADMIN"].includes(u?.role ?? "")) throw new Error("Forbidden");
}

const TYPES = ["ELECTRICITY", "OTE", "ROOF", "ANTENNA", "BOILER", "PUMP", "FIRE", "WATER", "OTHER"] as const;
export type InfraType = (typeof TYPES)[number];
export type InfraInput = {
  name: string; type: InfraType; floorLabel?: string | null; location?: string | null;
  locked?: boolean; accessNotes?: string | null; keyHolder?: string | null; notes?: string | null;
};
const clean = (v?: string | null) => (v?.trim() ? v.trim() : null);

export async function createInfraPoint(buildingId: string, data: InfraInput) {
  await requireStaff();
  if (!data.name?.trim()) return { error: "Το όνομα είναι υποχρεωτικό" };
  const type = TYPES.includes(data.type) ? data.type : "OTHER";
  const row = await db.infraPoint.create({
    data: {
      buildingId, name: data.name.trim(), type: type as any,
      floorLabel: clean(data.floorLabel), location: clean(data.location),
      locked: !!data.locked, accessNotes: clean(data.accessNotes), keyHolder: clean(data.keyHolder), notes: clean(data.notes),
    },
  });
  revalidatePath(`/super-admin/buildings/${buildingId}`);
  return { infra: row };
}

export async function updateInfraPoint(id: string, data: Partial<InfraInput>) {
  await requireStaff();
  const row = await db.infraPoint.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.type !== undefined ? { type: (TYPES.includes(data.type) ? data.type : "OTHER") as any } : {}),
      ...(data.floorLabel !== undefined ? { floorLabel: clean(data.floorLabel) } : {}),
      ...(data.location !== undefined ? { location: clean(data.location) } : {}),
      ...(data.locked !== undefined ? { locked: !!data.locked } : {}),
      ...(data.accessNotes !== undefined ? { accessNotes: clean(data.accessNotes) } : {}),
      ...(data.keyHolder !== undefined ? { keyHolder: clean(data.keyHolder) } : {}),
      ...(data.notes !== undefined ? { notes: clean(data.notes) } : {}),
    },
    select: { buildingId: true },
  });
  revalidatePath(`/super-admin/buildings/${row.buildingId}`);
  return { ok: true };
}

export async function deleteInfraPoint(id: string) {
  await requireStaff();
  const row = await db.infraPoint.findUnique({ where: { id }, select: { buildingId: true } });
  await db.infraPoint.delete({ where: { id } });
  if (row) revalidatePath(`/super-admin/buildings/${row.buildingId}`);
  return { ok: true };
}

/** Upload a photo for an infra point. FormData: infraPointId, file. */
export async function uploadInfraPhoto(formData: FormData) {
  await requireStaff();
  const infraPointId = String(formData.get("infraPointId") || "");
  const file = formData.get("file") as File | null;
  if (!infraPointId || !file) return { error: "Λείπει αρχείο" };
  const point = await db.infraPoint.findUnique({ where: { id: infraPointId }, select: { buildingId: true, building: { select: { propertyId: true } } } });
  if (!point) return { error: "Το σημείο δεν βρέθηκε" };
  const buffer = Buffer.from(await file.arrayBuffer());
  const safe = file.name.replace(/[^\w.\-]+/g, "_").slice(0, 100);
  const path = `${buildingFolder(point.building.propertyId, point.buildingId)}/infra/${Date.now()}-${safe}`;
  const res = await uploadFile({ path, buffer, contentType: file.type || "image/jpeg" });
  if (!res.success || !res.url) return { error: res.error || "Αποτυχία ανεβάσματος" };
  await db.infraPoint.update({ where: { id: infraPointId }, data: { photoUrl: res.url } });
  revalidatePath(`/super-admin/buildings/${point.buildingId}`);
  return { url: res.url };
}
