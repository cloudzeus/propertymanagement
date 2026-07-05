"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { uploadBuildingFile } from "./building-files";
import { assertBuildingAccess } from "./recurring-tasks";

const FREQ_ADVANCE: Record<string, (d: Date) => Date> = {
  WEEKLY: (d) => { const x = new Date(d); x.setDate(x.getDate() + 7); return x; },
  MONTHLY: (d) => { const x = new Date(d); x.setMonth(x.getMonth() + 1); return x; },
  QUARTERLY: (d) => { const x = new Date(d); x.setMonth(x.getMonth() + 3); return x; },
  SEMIANNUAL: (d) => { const x = new Date(d); x.setMonth(x.getMonth() + 6); return x; },
  ANNUAL: (d) => { const x = new Date(d); x.setFullYear(x.getFullYear() + 1); return x; },
  CUSTOM: (d) => d,
};

async function requireStaff() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const u = await db.user.findUnique({ where: { id: session.user.id as string }, select: { id: true, role: true } });
  if (!["SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE", "PROPERTY_ADMIN"].includes(u?.role ?? "")) throw new Error("Forbidden");
  return u!;
}

/** Complete a maintenance task: optional certificate upload → MaintenanceLog → advance nextDueDate. */
export async function completeMaintenance(
  taskId: string,
  data: { performedAt: string; cost?: string | null; notes?: string | null },
  formData?: FormData,
) {
  const user = await requireStaff();
  const task = await db.recurringTask.findUnique({
    where: { id: taskId },
    select: { id: true, buildingId: true, frequency: true, nextDueDate: true },
  });
  if (!task) return { error: "Δεν βρέθηκε" };
  await assertBuildingAccess(user.id, user.role, task.buildingId);

  let documentFileId: string | undefined;
  const file = formData?.get("file");
  if (file && file instanceof File && file.size > 0) {
    const fd = new FormData();
    fd.set("buildingId", task.buildingId);
    fd.set("category", "MAINTENANCE");
    fd.set("file", file);
    const up = await uploadBuildingFile(fd);
    if ("error" in up && up.error) return { error: up.error };
    documentFileId = (up as { file: { id: string } }).file.id;
  }

  await db.maintenanceLog.create({
    data: {
      recurringTaskId: task.id,
      buildingId: task.buildingId,
      performedAt: new Date(data.performedAt),
      performedById: user.id,
      cost: data.cost?.trim() ? data.cost.trim() : null,
      notes: data.notes?.trim() ? data.notes.trim() : null,
      documentFileId,
    },
  });

  const base = task.nextDueDate ?? new Date();
  const next = task.frequency === "CUSTOM" ? task.nextDueDate : FREQ_ADVANCE[task.frequency](base);
  await db.recurringTask.update({
    where: { id: task.id },
    data: { lastDoneDate: new Date(), nextDueDate: next, reminderSentAt: null },
  });

  revalidatePath(`/super-admin/buildings/${task.buildingId}`);
  return { ok: true };
}

export async function listMaintenanceHistory(buildingId: string) {
  const user = await requireStaff();
  await assertBuildingAccess(user.id, user.role, buildingId);
  const rows = await db.maintenanceLog.findMany({
    where: { buildingId },
    orderBy: { performedAt: "desc" },
    select: {
      id: true, performedAt: true, cost: true, notes: true,
      recurringTask: { select: { title: true, kind: true } },
      performedBy: { select: { name: true, email: true } },
      documentFile: { select: { url: true, name: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    performedAt: r.performedAt.toISOString(),
    title: r.recurringTask?.title ?? "—",
    kind: r.recurringTask?.kind ?? "GENERAL",
    cost: r.cost ? r.cost.toString() : null,
    notes: r.notes,
    performedBy: r.performedBy?.name ?? r.performedBy?.email ?? null,
    documentUrl: r.documentFile?.url ?? null,
    documentName: r.documentFile?.name ?? null,
  }));
}
