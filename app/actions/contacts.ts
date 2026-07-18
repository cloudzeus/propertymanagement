"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireBuildingCap } from "@/lib/building-access";
import { publishBuildingEvent } from "@/lib/realtime/bus";

export type ContactInput = { name: string; category?: string | null; phone?: string | null; email?: string | null; notes?: string | null };
const clean = (v?: string | null) => (v?.trim() ? v.trim() : null);

export async function createContact(buildingId: string, data: ContactInput) {
  await requireBuildingCap(buildingId, "manageContacts");
  if (!data.name?.trim()) return { error: "Το όνομα είναι υποχρεωτικό" };
  const row = await db.contact.create({
    data: { buildingId, name: data.name.trim(), category: clean(data.category), phone: clean(data.phone), email: clean(data.email), notes: clean(data.notes) },
  });
  revalidatePath(`/super-admin/buildings/${buildingId}`);
  revalidatePath(`/building/${buildingId}`);
  publishBuildingEvent(buildingId, "contact");
  return { contact: row };
}

export async function updateContact(id: string, data: Partial<ContactInput>) {
  const existing = await db.contact.findUnique({ where: { id }, select: { buildingId: true } });
  if (!existing) return { error: "Δεν βρέθηκε" };
  await requireBuildingCap(existing.buildingId, "manageContacts");
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
  revalidatePath(`/building/${c.buildingId}`);
  publishBuildingEvent(c.buildingId, "contact");
  return { ok: true };
}

export async function deleteContact(id: string) {
  const c = await db.contact.findUnique({ where: { id }, select: { buildingId: true } });
  if (!c) return { ok: true };
  await requireBuildingCap(c.buildingId, "manageContacts");
  await db.contact.delete({ where: { id } });
  revalidatePath(`/super-admin/buildings/${c.buildingId}`);
  revalidatePath(`/building/${c.buildingId}`);
  publishBuildingEvent(c.buildingId, "contact");
  return { ok: true };
}
