"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

async function requireManagers() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const u = await db.user.findUnique({ where: { id: session.user.id as string }, select: { role: true } });
  if (!["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(u?.role ?? "")) throw new Error("Forbidden");
}

export type ManagedItemTypeInput = { name: string; notes?: string | null; active?: boolean };
const clean = (v?: string | null) => (v?.trim() ? v.trim() : null);

export async function createManagedItemType(data: ManagedItemTypeInput) {
  await requireManagers();
  const name = data.name?.trim();
  if (!name) return { error: "Το όνομα είναι υποχρεωτικό" };
  const exists = await db.managedItemType.findUnique({ where: { name } });
  if (exists) return { error: "Υπάρχει ήδη στοιχείο με αυτό το όνομα" };
  const row = await db.managedItemType.create({
    data: { name, notes: clean(data.notes), active: data.active ?? true },
  });
  revalidatePath("/super-admin/managed-items");
  return { type: row };
}

export async function updateManagedItemType(id: string, data: ManagedItemTypeInput) {
  await requireManagers();
  const name = data.name?.trim();
  if (!name) return { error: "Το όνομα είναι υποχρεωτικό" };
  const dup = await db.managedItemType.findFirst({ where: { name, NOT: { id } }, select: { id: true } });
  if (dup) return { error: "Υπάρχει ήδη στοιχείο με αυτό το όνομα" };
  await db.managedItemType.update({
    where: { id },
    data: { name, notes: clean(data.notes), ...(data.active !== undefined ? { active: data.active } : {}) },
  });
  revalidatePath("/super-admin/managed-items");
  return { ok: true };
}

export async function deleteManagedItemType(id: string) {
  await requireManagers();
  const usage = await db.managedItem.count({ where: { itemTypeId: id } });
  if (usage > 0) return { error: `Χρησιμοποιείται σε ${usage} ${usage === 1 ? "κτήριο" : "καταχωρήσεις κτηρίων"} — απενεργοποίησέ το αντί για διαγραφή` };
  await db.managedItemType.delete({ where: { id } });
  revalidatePath("/super-admin/managed-items");
  return { ok: true };
}
