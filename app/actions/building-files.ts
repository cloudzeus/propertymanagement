"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { uploadFile, deleteFile, buildingFolder } from "@/lib/bunnycdn";

async function requireStaff() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const user = await db.user.findUnique({ where: { id: session.user.id as string }, select: { id: true, role: true } });
  if (!["SUPER_ADMIN", "ADMIN", "MANAGER", "PROPERTY_ADMIN"].includes(user?.role ?? "")) throw new Error("Forbidden");
  return user!;
}

const CATEGORIES = ["PLANS", "PHOTOS", "DOCUMENTS", "CERTIFICATES", "MAINTENANCE", "OTHER"] as const;
type Category = (typeof CATEGORIES)[number];

function sanitize(name: string) {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 120);
}

/** Upload a file to the building's BunnyCDN folder and record it. Expects FormData
 *  with: buildingId, category, file. */
export async function uploadBuildingFile(formData: FormData) {
  const me = await requireStaff();
  const buildingId = String(formData.get("buildingId") || "");
  const category = (String(formData.get("category") || "OTHER").toUpperCase()) as Category;
  const file = formData.get("file") as File | null;
  if (!buildingId || !file) return { error: "Λείπει αρχείο ή κτήριο" };
  if (!CATEGORIES.includes(category)) return { error: "Μη έγκυρη κατηγορία" };

  const building = await db.building.findUnique({ where: { id: buildingId }, select: { propertyId: true } });
  if (!building) return { error: "Το κτήριο δεν βρέθηκε" };

  const buffer = Buffer.from(await file.arrayBuffer());
  const path = `${buildingFolder(building.propertyId, buildingId)}/${category.toLowerCase()}/${Date.now()}-${sanitize(file.name)}`;
  const res = await uploadFile({ path, buffer, contentType: file.type || "application/octet-stream" });
  if (!res.success || !res.url) return { error: res.error || "Αποτυχία ανεβάσματος" };

  const row = await db.buildingFile.create({
    data: {
      buildingId, category, name: file.name, cdnPath: path, url: res.url,
      mimeType: file.type || null, sizeBytes: file.size, uploadedById: me.id,
    },
  });

  revalidatePath(`/super-admin/buildings/${buildingId}`);
  return { file: { id: row.id, name: row.name, url: row.url, category: row.category, mimeType: row.mimeType, sizeBytes: row.sizeBytes, createdAt: row.createdAt } };
}

/** Delete a building file (CDN object + record). */
export async function deleteBuildingFile(fileId: string) {
  await requireStaff();
  const f = await db.buildingFile.findUnique({ where: { id: fileId }, select: { buildingId: true, cdnPath: true } });
  if (!f) return { error: "Το αρχείο δεν βρέθηκε" };
  await deleteFile(f.cdnPath); // best-effort; record removal proceeds regardless
  await db.buildingFile.delete({ where: { id: fileId } });
  revalidatePath(`/super-admin/buildings/${f.buildingId}`);
  return { ok: true };
}
