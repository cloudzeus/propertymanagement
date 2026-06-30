"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";

async function requireSuperAdmin() {
  const session = await auth();
  if ((session?.user as any)?.role !== "SUPER_ADMIN") throw new Error("Forbidden");
}

export async function updateSection(id: string, data: unknown): Promise<void> {
  await requireSuperAdmin();
  await db.landingSection.update({ where: { id }, data: { data: data as any } });
  revalidatePath("/");
  revalidatePath("/super-admin/cms/landing");
}

export async function toggleSection(id: string): Promise<void> {
  await requireSuperAdmin();
  const row = await db.landingSection.findUnique({ where: { id } });
  if (!row) throw new Error("Not found");
  await db.landingSection.update({ where: { id }, data: { enabled: !row.enabled } });
  revalidatePath("/");
  revalidatePath("/super-admin/cms/landing");
}

export async function reorderSection(id: string, dir: "up" | "down"): Promise<void> {
  await requireSuperAdmin();
  const all = await db.landingSection.findMany({ orderBy: { order: "asc" } });
  const i = all.findIndex((s) => s.id === id);
  const j = dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= all.length) return;
  await db.$transaction([
    db.landingSection.update({ where: { id: all[i].id }, data: { order: all[j].order } }),
    db.landingSection.update({ where: { id: all[j].id }, data: { order: all[i].order } }),
  ]);
  revalidatePath("/");
  revalidatePath("/super-admin/cms/landing");
}
