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

const FREQS = ["WEEKLY", "MONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL", "CUSTOM"] as const;
export type TaskFrequency = (typeof FREQS)[number];
export type TaskInput = { title: string; frequency: TaskFrequency; nextDueDate?: string | null; vendor?: string | null; notes?: string | null; active?: boolean };
const clean = (v?: string | null) => (v?.trim() ? v.trim() : null);

function advance(date: Date, freq: TaskFrequency): Date {
  const d = new Date(date);
  switch (freq) {
    case "WEEKLY": d.setDate(d.getDate() + 7); break;
    case "MONTHLY": d.setMonth(d.getMonth() + 1); break;
    case "QUARTERLY": d.setMonth(d.getMonth() + 3); break;
    case "SEMIANNUAL": d.setMonth(d.getMonth() + 6); break;
    case "ANNUAL": d.setFullYear(d.getFullYear() + 1); break;
    case "CUSTOM": break;
  }
  return d;
}

export async function createRecurringTask(buildingId: string, data: TaskInput) {
  await requireStaff();
  if (!data.title?.trim()) return { error: "Ο τίτλος είναι υποχρεωτικός" };
  const freq = FREQS.includes(data.frequency) ? data.frequency : "MONTHLY";
  const row = await db.recurringTask.create({
    data: {
      buildingId, title: data.title.trim(), frequency: freq as any,
      nextDueDate: data.nextDueDate ? new Date(data.nextDueDate) : null,
      vendor: clean(data.vendor), notes: clean(data.notes), active: data.active ?? true,
    },
  });
  revalidatePath(`/super-admin/buildings/${buildingId}`);
  return { task: row.id };
}

export async function updateRecurringTask(id: string, data: Partial<TaskInput>) {
  await requireStaff();
  const row = await db.recurringTask.update({
    where: { id },
    data: {
      ...(data.title !== undefined ? { title: data.title.trim() } : {}),
      ...(data.frequency !== undefined ? { frequency: (FREQS.includes(data.frequency) ? data.frequency : "MONTHLY") as any } : {}),
      ...(data.nextDueDate !== undefined ? { nextDueDate: data.nextDueDate ? new Date(data.nextDueDate) : null } : {}),
      ...(data.vendor !== undefined ? { vendor: clean(data.vendor) } : {}),
      ...(data.notes !== undefined ? { notes: clean(data.notes) } : {}),
      ...(data.active !== undefined ? { active: data.active } : {}),
    },
    select: { buildingId: true },
  });
  revalidatePath(`/super-admin/buildings/${row.buildingId}`);
  return { ok: true };
}

/** Mark as done: stamp lastDoneDate and advance nextDueDate by one interval. */
export async function markTaskDone(id: string) {
  await requireStaff();
  const t = await db.recurringTask.findUnique({ where: { id }, select: { buildingId: true, frequency: true, nextDueDate: true } });
  if (!t) return { error: "Δεν βρέθηκε" };
  const base = t.nextDueDate ?? new Date();
  const next = t.frequency === "CUSTOM" ? t.nextDueDate : advance(base, t.frequency as TaskFrequency);
  await db.recurringTask.update({ where: { id }, data: { lastDoneDate: new Date(), nextDueDate: next } });
  revalidatePath(`/super-admin/buildings/${t.buildingId}`);
  return { ok: true };
}

export async function deleteRecurringTask(id: string) {
  await requireStaff();
  const t = await db.recurringTask.findUnique({ where: { id }, select: { buildingId: true } });
  await db.recurringTask.delete({ where: { id } });
  if (t) revalidatePath(`/super-admin/buildings/${t.buildingId}`);
  return { ok: true };
}
