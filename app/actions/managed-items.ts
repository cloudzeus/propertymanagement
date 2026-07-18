"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { uploadFile, deleteFile, buildingFolder } from "@/lib/bunnycdn";
import { requireBuildingCap } from "@/lib/building-access";

async function assertManagedBuilding(buildingId: string) {
  const b = await db.building.findUnique({ where: { id: buildingId }, select: { property: { select: { managed: true } } } });
  if (!b) throw new Error("Building not found");
  if (!b.property.managed) return { error: "Το κτήριο είναι σε αυτοδιαχείριση — δεν επιτρέπονται διαχειριζόμενα στοιχεία" };
  return null;
}

export type ManagedItemInput = { itemTypeId: string; location: string; floorLabel?: string | null; quantity?: number | null; notes?: string | null };
const clean = (v?: string | null) => (v?.trim() ? v.trim() : null);

function validate(data: ManagedItemInput) {
  if (!data.itemTypeId) return "Επίλεξε στοιχείο από τη λίστα";
  if (!data.location?.trim()) return "Η τοποθεσία είναι υποχρεωτική";
  const q = data.quantity ?? 1;
  if (!Number.isInteger(q) || q < 1 || q > 100000) return "Η ποσότητα πρέπει να είναι ακέραιος αριθμός ≥ 1";
  return null;
}

export async function createManagedItem(buildingId: string, data: ManagedItemInput) {
  await requireBuildingCap(buildingId, "manageManagedItems");
  const guard = await assertManagedBuilding(buildingId);
  if (guard) return guard;
  const err = validate(data);
  if (err) return { error: err };
  const type = await db.managedItemType.findUnique({ where: { id: data.itemTypeId }, select: { id: true } });
  if (!type) return { error: "Το στοιχείο δεν βρέθηκε στον κατάλογο" };
  const row = await db.managedItem.create({
    data: {
      buildingId,
      itemTypeId: data.itemTypeId,
      location: data.location.trim(),
      floorLabel: clean(data.floorLabel),
      quantity: data.quantity ?? 1,
      notes: clean(data.notes),
    },
  });
  revalidatePath(`/super-admin/buildings/${buildingId}`);
  revalidatePath(`/building/${buildingId}`);
  return { itemId: row.id };
}

export async function updateManagedItem(id: string, data: ManagedItemInput) {
  const existing = await db.managedItem.findUnique({ where: { id }, select: { buildingId: true } });
  if (!existing) return { error: "Δεν βρέθηκε" };
  await requireBuildingCap(existing.buildingId, "manageManagedItems");
  const err = validate(data);
  if (err) return { error: err };
  const row = await db.managedItem.update({
    where: { id },
    data: {
      itemTypeId: data.itemTypeId,
      location: data.location.trim(),
      floorLabel: clean(data.floorLabel),
      quantity: data.quantity ?? 1,
      notes: clean(data.notes),
    },
    select: { buildingId: true },
  });
  revalidatePath(`/super-admin/buildings/${row.buildingId}`);
  revalidatePath(`/building/${row.buildingId}`);
  return { ok: true, itemId: id };
}

export async function deleteManagedItem(id: string) {
  const row = await db.managedItem.findUnique({ where: { id }, select: { buildingId: true, photoCdnPath: true } });
  if (row) await requireBuildingCap(row.buildingId, "manageManagedItems");
  if (row?.photoCdnPath) await deleteFile(row.photoCdnPath).catch(() => {});
  await db.managedItem.delete({ where: { id } });
  if (row) {
    revalidatePath(`/super-admin/buildings/${row.buildingId}`);
    revalidatePath(`/building/${row.buildingId}`);
  }
  return { ok: true };
}

/** Upload/replace the optional photo of a managed item. FormData: itemId, file. */
export async function uploadManagedItemPhoto(formData: FormData) {
  const itemId = String(formData.get("itemId") || "");
  const file = formData.get("file") as File | null;
  if (!itemId || !file) return { error: "Λείπει αρχείο" };
  if (!(file.type || "").startsWith("image/")) return { error: "Επιτρέπονται μόνο εικόνες" };
  const item = await db.managedItem.findUnique({
    where: { id: itemId },
    select: { buildingId: true, photoCdnPath: true, building: { select: { propertyId: true } } },
  });
  if (!item) return { error: "Το στοιχείο δεν βρέθηκε" };
  await requireBuildingCap(item.buildingId, "manageManagedItems");
  const buffer = Buffer.from(await file.arrayBuffer());
  const safe = file.name.replace(/[^\w.\-]+/g, "_").slice(0, 100);
  const path = `${buildingFolder(item.building.propertyId, item.buildingId)}/managed-items/${itemId}/${Date.now()}-${safe}`;
  const res = await uploadFile({ path, buffer, contentType: file.type || "application/octet-stream" });
  if (!res.success || !res.url) return { error: res.error || "Αποτυχία ανεβάσματος" };
  if (item.photoCdnPath) await deleteFile(item.photoCdnPath).catch(() => {});
  await db.managedItem.update({ where: { id: itemId }, data: { photoUrl: res.url, photoCdnPath: path } });
  revalidatePath(`/super-admin/buildings/${item.buildingId}`);
  revalidatePath(`/building/${item.buildingId}`);
  return { url: res.url };
}

export async function deleteManagedItemPhoto(itemId: string) {
  const item = await db.managedItem.findUnique({ where: { id: itemId }, select: { buildingId: true, photoCdnPath: true } });
  if (!item) return { error: "Δεν βρέθηκε" };
  await requireBuildingCap(item.buildingId, "manageManagedItems");
  if (item.photoCdnPath) await deleteFile(item.photoCdnPath).catch(() => {});
  await db.managedItem.update({ where: { id: itemId }, data: { photoUrl: null, photoCdnPath: null } });
  revalidatePath(`/super-admin/buildings/${item.buildingId}`);
  revalidatePath(`/building/${item.buildingId}`);
  return { ok: true };
}
