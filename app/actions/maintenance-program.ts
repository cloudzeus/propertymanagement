"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getEffectiveSession } from "@/lib/auth-effective";
import { requirePermission } from "@/lib/rbac/permissions";
import { resolveResponsibility, computeSlaDueAt, notifyStakeholders } from "@/lib/maintenance-requests";
import { publishBuildingEvent } from "@/lib/realtime/bus";

/** Company staff: set (or clear) the registry supplier who serves this schedule. */
export async function assignProgrammeSupplier(taskId: string, supplierId: string | null) {
  await requirePermission("maintenance-program", "edit");
  const task = await db.recurringTask.findUnique({ where: { id: taskId }, select: { buildingId: true } });
  if (!task) return { error: "Δεν βρέθηκε" };
  if (supplierId) {
    const ok = await db.supplier.findFirst({ where: { id: supplierId, customerId: null, isPlatform: false, isActive: true }, select: { id: true } });
    if (!ok) return { error: "Ο συνεργάτης δεν ανήκει στο μητρώο της εταιρείας" };
  }
  await db.recurringTask.update({ where: { id: taskId }, data: { supplierId } });
  revalidatePath("/admin/maintenance-program");
  revalidatePath(`/building/${task.buildingId}`);
  return { ok: true };
}

/**
 * Open a fault for one occurrence of a schedule (e.g. "Συντήρηση ανελκυστήρα —
 * Μάρτιος"). Pre-assigns the schedule's supplier so the crew is notified at once.
 */
export async function openProgrammeOccurrence(taskId: string, dateIso: string) {
  await requirePermission("maintenance-program", "create");
  const eff = await getEffectiveSession();
  if (!eff) return { error: "Unauthorized" };
  const task = await db.recurringTask.findUnique({
    where: { id: taskId },
    select: { id: true, title: true, notes: true, buildingId: true, supplierId: true, kind: true, managedItem: { select: { itemType: { select: { name: true } }, location: true } }, building: { select: { name: true } } },
  });
  if (!task) return { error: "Δεν βρέθηκε" };
  const date = new Date(dateIso);
  if (isNaN(date.getTime())) return { error: "Μη έγκυρη ημερομηνία" };
  const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
  const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
  const dup = await db.maintenanceRequest.findFirst({ where: { recurringTaskId: taskId, OR: [{ scheduledDate: { gte: monthStart, lte: monthEnd } }, { scheduledDate: null, createdAt: { gte: monthStart, lte: monthEnd } }] }, select: { id: true } });
  if (dup) return { id: dup.id, existing: true };

  const handledBy = await resolveResponsibility(task.buildingId, null);
  const monthLabel = date.toLocaleDateString("el-GR", { month: "long", year: "numeric" });
  const desc = [
    `Προγραμματισμένη συντήρηση (${monthLabel}) από το ετήσιο πρόγραμμα.`,
    task.managedItem ? `Στοιχείο: ${task.managedItem.itemType.name}${task.managedItem.location ? ` — ${task.managedItem.location}` : ""}.` : null,
    task.notes ? `Σημειώσεις: ${task.notes}` : null,
  ].filter(Boolean).join("\n");
  const row = await db.maintenanceRequest.create({
    data: {
      buildingId: task.buildingId, title: task.title, description: desc, category: "maintenance", priority: "NORMAL",
      status: task.supplierId ? "ASSIGNED" : "OPEN", handledBy, slaDueAt: handledBy === "COMPANY" ? computeSlaDueAt(null, "NORMAL") : null,
      reportedById: eff.user.id, supplierId: task.supplierId, recurringTaskId: task.id, scheduledDate: date,
      statusEvents: { create: [{ toStatus: "OPEN", byUserId: eff.user.id, note: `Από ετήσιο πρόγραμμα — ${monthLabel}` }, ...(task.supplierId ? [{ fromStatus: "OPEN", toStatus: "ASSIGNED", byUserId: eff.user.id, note: "Ανάθεση στον συνεργάτη του προγράμματος" }] : [])] },
    },
    select: { id: true },
  });
  await notifyStakeholders({ requestId: row.id, type: "MAINTENANCE_ASSIGNED", title: `Προγραμματισμένη συντήρηση: ${task.title}`, body: `${task.building.name} — ${monthLabel}. Ανοίχθηκε από το ετήσιο πρόγραμμα συντηρήσεων.`, excludeUserId: eff.user.id });
  revalidatePath("/admin/maintenance-program"); revalidatePath("/admin/maintenance"); revalidatePath(`/building/${task.buildingId}`);
  publishBuildingEvent(task.buildingId, "maintenance");
  return { id: row.id, existing: false };
}
