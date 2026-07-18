"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireBuildingCap } from "@/lib/building-access";

const FREQS = ["WEEKLY", "MONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL", "CUSTOM"] as const;
export type TaskFrequency = (typeof FREQS)[number];
const KINDS = ["GENERAL","ELEVATOR","BOILER","FIRE_SAFETY","HVAC","ELECTRICAL","PLUMBING","OTHER"] as const;
export type MaintenanceKind = (typeof KINDS)[number];
export type TaskInput = { title: string; frequency: TaskFrequency; nextDueDate?: string | null; vendor?: string | null; notes?: string | null; active?: boolean; kind?: MaintenanceKind; inServicePackage?: boolean; reminderDaysBefore?: number };
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
  await requireBuildingCap(buildingId, "manageCalendar");
  if (!data.title?.trim()) return { error: "Ο τίτλος είναι υποχρεωτικός" };
  const freq = FREQS.includes(data.frequency) ? data.frequency : "MONTHLY";
  const row = await db.recurringTask.create({
    data: {
      buildingId, title: data.title.trim(), frequency: freq as any,
      nextDueDate: data.nextDueDate ? new Date(data.nextDueDate) : null,
      vendor: clean(data.vendor), notes: clean(data.notes), active: data.active ?? true,
      kind: (KINDS.includes(data.kind as any) ? data.kind : "GENERAL") as any,
      inServicePackage: data.inServicePackage ?? false,
      reminderDaysBefore: Number.isFinite(data.reminderDaysBefore) ? Number(data.reminderDaysBefore) : 7,
    },
  });
  revalidatePath(`/super-admin/buildings/${buildingId}`);
  revalidatePath(`/building/${buildingId}`);
  return { task: row.id };
}

export async function updateRecurringTask(id: string, data: Partial<TaskInput>) {
  const existing = await db.recurringTask.findUnique({ where: { id }, select: { buildingId: true } });
  if (!existing) return { error: "Δεν βρέθηκε" };
  await requireBuildingCap(existing.buildingId, "manageCalendar");
  const row = await db.recurringTask.update({
    where: { id },
    data: {
      ...(data.title !== undefined ? { title: data.title.trim() } : {}),
      ...(data.frequency !== undefined ? { frequency: (FREQS.includes(data.frequency) ? data.frequency : "MONTHLY") as any } : {}),
      ...(data.nextDueDate !== undefined ? { nextDueDate: data.nextDueDate ? new Date(data.nextDueDate) : null } : {}),
      ...(data.vendor !== undefined ? { vendor: clean(data.vendor) } : {}),
      ...(data.notes !== undefined ? { notes: clean(data.notes) } : {}),
      ...(data.active !== undefined ? { active: data.active } : {}),
      ...(data.kind !== undefined ? { kind: (KINDS.includes(data.kind as any) ? data.kind : "GENERAL") as any } : {}),
      ...(data.inServicePackage !== undefined ? { inServicePackage: data.inServicePackage } : {}),
      ...(data.reminderDaysBefore !== undefined ? { reminderDaysBefore: Number(data.reminderDaysBefore) } : {}),
    },
    select: { buildingId: true },
  });
  revalidatePath(`/super-admin/buildings/${row.buildingId}`);
  revalidatePath(`/building/${row.buildingId}`);
  return { ok: true };
}

/** Mark as done: stamp lastDoneDate and advance nextDueDate by one interval. */
export async function markTaskDone(id: string) {
  const t = await db.recurringTask.findUnique({ where: { id }, select: { buildingId: true, frequency: true, nextDueDate: true } });
  if (!t) return { error: "Δεν βρέθηκε" };
  await requireBuildingCap(t.buildingId, "manageCalendar");
  const base = t.nextDueDate ?? new Date();
  const next = t.frequency === "CUSTOM" ? t.nextDueDate : advance(base, t.frequency as TaskFrequency);
  await db.recurringTask.update({ where: { id }, data: { lastDoneDate: new Date(), nextDueDate: next, reminderSentAt: null } });
  revalidatePath(`/super-admin/buildings/${t.buildingId}`);
  revalidatePath(`/building/${t.buildingId}`);
  return { ok: true };
}

export async function deleteRecurringTask(id: string) {
  const t = await db.recurringTask.findUnique({ where: { id }, select: { buildingId: true } });
  if (!t) return { error: "Δεν βρέθηκε" };
  await requireBuildingCap(t.buildingId, "manageCalendar");
  await db.recurringTask.delete({ where: { id } });
  if (t) {
    revalidatePath(`/super-admin/buildings/${t.buildingId}`);
    revalidatePath(`/building/${t.buildingId}`);
  }
  return { ok: true };
}
