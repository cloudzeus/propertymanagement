"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { deleteFile } from "@/lib/bunnycdn";
async function requireSuperAdmin() { const s = await auth(); if ((s?.user as any)?.role !== "SUPER_ADMIN") throw new Error("Forbidden"); }
export async function deleteMedia(id: string): Promise<void> {
  await requireSuperAdmin();
  const row = await db.mediaAsset.findUnique({ where: { id } });
  if (!row) return;
  try { await deleteFile(row.cdnPath); } catch { /* best-effort */ }
  await db.mediaAsset.delete({ where: { id } });
  revalidatePath("/super-admin/cms/media");
}
export async function updateMediaMeta(id: string, data: { alt?: string; title?: string }): Promise<void> {
  await requireSuperAdmin();
  await db.mediaAsset.update({ where: { id }, data: { alt: data.alt ?? null, title: data.title ?? null } });
  revalidatePath("/super-admin/cms/media");
}
