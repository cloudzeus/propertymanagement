"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

async function requireStaff() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const u = await db.user.findUnique({ where: { id: session.user.id as string }, select: { role: true } });
  if (!["SUPER_ADMIN", "ADMIN", "MANAGER", "PROPERTY_ADMIN"].includes(u?.role ?? "")) throw new Error("Forbidden");
}

export type ContactInput = { name: string; category?: string | null; phone?: string | null; email?: string | null; notes?: string | null };
const clean = (v?: string | null) => (v?.trim() ? v.trim() : null);

export async function createContact(buildingId: string, data: ContactInput) {
  await requireStaff();
  if (!data.name?.trim()) return { error: "Το όνομα είναι υποχρεωτικό" };
  const row = await db.contact.create({
    data: { buildingId, name: data.name.trim(), category: clean(data.category), phone: clean(data.phone), email: clean(data.email), notes: clean(data.notes) },
  });
  revalidatePath(`/super-admin/buildings/${buildingId}`);
  return { contact: row };
}

export async function updateContact(id: string, data: Partial<ContactInput>) {
  await requireStaff();
  const c = await db.contact.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.category !== undefined ? { category: clean(data.category) } : {}),
      ...(data.phone !== undefined ? { phone: clean(data.phone) } : {}),
      ...(data.email !== undefined ? { email: clean(data.email) } : {}),
      ...(data.notes !== undefined ? { notes: clean(data.notes) } : {}),
    },
    select: { buildingId: true },
  });
  revalidatePath(`/super-admin/buildings/${c.buildingId}`);
  return { ok: true };
}

export async function deleteContact(id: string) {
  await requireStaff();
  const c = await db.contact.findUnique({ where: { id }, select: { buildingId: true } });
  await db.contact.delete({ where: { id } });
  if (c) revalidatePath(`/super-admin/buildings/${c.buildingId}`);
  return { ok: true };
}
