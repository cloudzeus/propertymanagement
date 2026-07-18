"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { uploadFile, deleteFile, buildingFolder } from "@/lib/bunnycdn";

async function requireStaff() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const u = await db.user.findUnique({ where: { id: session.user.id as string }, select: { role: true } });
  if (!["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(u?.role ?? "")) throw new Error("Forbidden");
}

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
  await requireStaff();
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
  return { itemId: row.id };
}

export async function updateManagedItem(id: string, data: ManagedItemInput) {
  await requireStaff();
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
  return { ok: true, itemId: id };
}

export async function deleteManagedItem(id: string) {
  await requireStaff();
  const row = await db.managedItem.findUnique({ where: { id }, select: { buildingId: true, photoCdnPath: true } });
  if (row?.photoCdnPath) await deleteFile(row.photoCdnPath).catch(() => {});
  await db.managedItem.delete({ where: { id } });
  if (row) revalidatePath(`/super-admin/buildings/${row.buildingId}`);
  return { ok: true };
}

/** Upload/replace the optional photo of a managed item. FormData: itemId, file. */
export async function uploadManagedItemPhoto(formData: FormData) {
  await requireStaff();
  const itemId = String(formData.get("itemId") || "");
  const file = formData.get("file") as File | null;
  if (!itemId || !file) return { error: "Λείπει αρχείο" };
  if (!(file.type || "").startsWith("image/")) return { error: "Επιτρέπονται μόνο εικόνες" };
  const item = await db.managedItem.findUnique({
    where: { id: itemId },
    select: { buildingId: true, photoCdnPath: true, building: { select: { propertyId: true } } },
  });
  if (!item) return { error: "Το στοιχείο δεν βρέθηκε" };
  const buffer = Buffer.from(await file.arrayBuffer());
  const safe = file.name.replace(/[^\w.\-]+/g, "_").slice(0, 100);
  const path = `${buildingFolder(item.building.propertyId, item.buildingId)}/managed-items/${itemId}/${Date.now()}-${safe}`;
  const res = await uploadFile({ path, buffer, contentType: file.type || "application/octet-stream" });
  if (!res.success || !res.url) return { error: res.error || "Αποτυχία ανεβάσματος" };
  if (item.photoCdnPath) await deleteFile(item.photoCdnPath).catch(() => {});
  await db.managedItem.update({ where: { id: itemId }, data: { photoUrl: res.url, photoCdnPath: path } });
  revalidatePath(`/super-admin/buildings/${item.buildingId}`);
  return { url: res.url };
}

export async function deleteManagedItemPhoto(itemId: string) {
  await requireStaff();
  const item = await db.managedItem.findUnique({ where: { id: itemId }, select: { buildingId: true, photoCdnPath: true } });
  if (!item) return { error: "Δεν βρέθηκε" };
  if (item.photoCdnPath) await deleteFile(item.photoCdnPath).catch(() => {});
  await db.managedItem.update({ where: { id: itemId }, data: { photoUrl: null, photoCdnPath: null } });
  revalidatePath(`/super-admin/buildings/${item.buildingId}`);
  return { ok: true };
}
