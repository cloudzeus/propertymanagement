"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getEffectiveSession } from "@/lib/auth-effective";
import {
  FAULT_STATUSES, FAULT_PRIORITIES, STATUS_TRANSITIONS, STATUS_LABELS,
  type FaultStatus, type FaultPriority,
} from "@/lib/maintenance-shared";
import {
  resolveResponsibility, computeSlaDueAt, notifyStakeholders, canAccessRequest,
} from "@/lib/maintenance-requests";
import { requireBuildingCap } from "@/lib/building-access";
import { publishBuildingEvent } from "@/lib/realtime/bus";

const STAFF_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE"];

async function requireUser() {
  const session = await getEffectiveSession();
  const u = session?.user;
  if (!u?.id) throw new Error("Unauthorized");
  return { id: u.id as string, role: (u.role as string) ?? "", companyId: (u as any).companyId as string | null };
}

const isStaff = (role: string) => STAFF_ROLES.includes(role);
const clean = (v?: string | null) => (v?.trim() ? v.trim() : null);

function revalidateAll(requestId?: string, buildingId?: string | null) {
  revalidatePath("/admin/maintenance");
  revalidatePath("/portal/requests");
  revalidatePath("/portal/maintenance");
  if (requestId) {
    revalidatePath(`/admin/maintenance/${requestId}`);
    revalidatePath(`/portal/requests/${requestId}`);
    revalidatePath(`/portal/maintenance/${requestId}`);
  }
  // Manager building-dashboard twin (fault-requests tab lives at /building/[id]).
  if (buildingId) {
    revalidatePath(`/building/${buildingId}`);
    publishBuildingEvent(buildingId, "maintenance");
  }
}

/** Μπορεί ο χρήστης να ΔΗΛΩΣΕΙ βλάβη στο κτήριο; (ένοικος/ιδιοκτήτης/διαχειριστής/staff) */
async function canReportInBuilding(userId: string, role: string, buildingId: string): Promise<boolean> {
  if (isStaff(role)) return true;
  // Managers go through the building-capability guard (createRequests);
  // a PROPERTY_ADMIN without an assignment may still report as unit occupant below.
  if (role === "PROPERTY_ADMIN") {
    try {
      await requireBuildingCap(buildingId, "createRequests");
      return true;
    } catch {
      /* fall through to the occupant check */
    }
  }
  const unit = await db.unit.findFirst({
    where: {
      buildingId,
      OR: [
        { ownerId: userId },
        { residentId: userId },
        { occupancies: { some: { userId, endDate: null } } },
      ],
    },
    select: { id: true },
  });
  return !!unit;
}

/* ------------------------------------------------------------------ */
/* Δημιουργία βλάβης                                                   */
/* ------------------------------------------------------------------ */

export type AttachmentInput = { url: string; cdnPath?: string | null; kind: "IMAGE" | "VIDEO"; contentType?: string | null; sizeBytes?: number | null };

export type CreateFaultInput = {
  buildingId: string;
  unitId?: string | null;
  title: string;
  description: string;
  categoryId?: string | null;
  priority?: FaultPriority;
  restrictedAccess?: boolean;
  attachments?: AttachmentInput[];
};

export async function createMaintenanceRequest(input: CreateFaultInput) {
  const user = await requireUser();
  if (!input.title?.trim()) return { error: "Ο τίτλος είναι υποχρεωτικός" };
  if (!input.description?.trim()) return { error: "Η περιγραφή είναι υποχρεωτική" };
  if (!(await canReportInBuilding(user.id, user.role, input.buildingId))) return { error: "Δεν έχετε πρόσβαση στο κτήριο" };

  if (input.unitId) {
    const unit = await db.unit.findFirst({ where: { id: input.unitId, buildingId: input.buildingId }, select: { id: true } });
    if (!unit) return { error: "Η μονάδα δεν ανήκει στο κτήριο." };
  }

  const priority: FaultPriority = FAULT_PRIORITIES.includes(input.priority as any) ? (input.priority as FaultPriority) : "NORMAL";
  const category = input.categoryId
    ? await db.maintenanceCategory.findUnique({ where: { id: input.categoryId }, select: { id: true, name: true, slaHours: true } })
    : null;

  const handledBy = await resolveResponsibility(input.buildingId, category?.id ?? null);
  const slaDueAt = handledBy === "COMPANY" ? computeSlaDueAt(category?.slaHours, priority) : null;

  const row = await db.maintenanceRequest.create({
    data: {
      buildingId: input.buildingId,
      unitId: clean(input.unitId),
      title: input.title.trim(),
      description: input.description.trim(),
      category: category?.name ?? "general",
      categoryId: category?.id ?? null,
      priority,
      status: "OPEN",
      handledBy,
      slaDueAt,
      restrictedAccess: !!input.restrictedAccess,
      reportedById: user.id,
      attachments: input.attachments?.length
        ? { create: input.attachments.map((a) => ({ url: a.url, cdnPath: a.cdnPath ?? null, kind: a.kind === "VIDEO" ? "VIDEO" : "IMAGE", contentType: a.contentType ?? null, sizeBytes: a.sizeBytes ?? null })) }
        : undefined,
      statusEvents: { create: { toStatus: "OPEN", byUserId: user.id, note: "Δήλωση βλάβης" } },
    },
    select: { id: true, title: true, building: { select: { name: true } } },
  });

  await notifyStakeholders({
    requestId: row.id,
    type: "MAINTENANCE_STATUS",
    title: `Νέα βλάβη: ${row.title}`,
    body: `Δηλώθηκε νέα βλάβη στο κτήριο «${row.building.name}». Υπεύθυνος: ${handledBy === "COMPANY" ? "εταιρία διαχείρισης" : "διαχειριστής ακινήτου"}.`,
    excludeUserId: user.id,
  });
  revalidateAll(row.id, input.buildingId);
  return { id: row.id };
}

/* ------------------------------------------------------------------ */
/* Αλλαγή κατάστασης / ανάθεση                                          */
/* ------------------------------------------------------------------ */

/** Μπορεί ο χρήστης να ΔΙΑΧΕΙΡΙΣΤΕΙ τη βλάβη (αλλαγή status κ.λπ.); */
async function canManageRequest(user: { id: string; role: string }, req: { handledBy: string; buildingId: string; reportedById: string | null; building: { propertyId: string } }) {
  if (isStaff(user.role)) return true;
  if (user.role !== "PROPERTY_ADMIN") return false;
  const assignment = await db.managementAssignment.findFirst({
    where: { userId: user.id, OR: [{ buildingId: req.buildingId }, { propertyId: req.building.propertyId }] },
    select: { id: true },
  });
  return !!assignment;
}

export async function changeRequestStatus(id: string, status: FaultStatus, note?: string) {
  const user = await requireUser();
  const req = await db.maintenanceRequest.findUnique({
    where: { id },
    select: { id: true, title: true, status: true, handledBy: true, buildingId: true, reportedById: true, firstResponseAt: true, building: { select: { propertyId: true } } },
  });
  if (!req) return { error: "Δεν βρέθηκε" };
  if (!FAULT_STATUSES.includes(status)) return { error: "Μη έγκυρη κατάσταση" };

  const isReporterCancel = status === "CANCELLED" && req.reportedById === user.id && req.status === "OPEN";
  if (!isReporterCancel && !(await canManageRequest(user, req))) return { error: "Δεν επιτρέπεται" };
  if (!STATUS_TRANSITIONS[req.status as FaultStatus]?.includes(status)) return { error: `Μη επιτρεπτή μετάβαση από «${STATUS_LABELS[req.status as FaultStatus]}»` };

  await db.maintenanceRequest.update({
    where: { id },
    data: {
      status,
      completedAt: status === "COMPLETED" ? new Date() : undefined,
      firstResponseAt: req.firstResponseAt ?? new Date(),
      statusEvents: { create: { fromStatus: req.status, toStatus: status, note: clean(note), byUserId: user.id } },
    },
  });

  await notifyStakeholders({
    requestId: id,
    type: "MAINTENANCE_STATUS",
    title: `Βλάβη «${req.title}»: ${STATUS_LABELS[status]}`,
    body: clean(note) ?? `Η κατάσταση άλλαξε σε «${STATUS_LABELS[status]}».`,
    excludeUserId: user.id,
  });
  revalidateAll(id, req.buildingId);
  return { ok: true };
}

/** Ανάθεση σε υπάλληλο — μόνο ADMIN/MANAGER (και SUPER_ADMIN). */
export async function assignRequest(id: string, assigneeId: string | null) {
  const user = await requireUser();
  if (!["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(user.role)) return { error: "Δεν επιτρέπεται" };
  const req = await db.maintenanceRequest.findUnique({ where: { id }, select: { id: true, title: true, status: true, buildingId: true } });
  if (!req) return { error: "Δεν βρέθηκε" };

  let assignee: { id: string; name: string | null } | null = null;
  if (assigneeId) {
    assignee = await db.user.findFirst({
      where: { id: assigneeId, role: { in: ["EMPLOYEE", "MANAGER", "ADMIN"] }, status: "ACTIVE" },
      select: { id: true, name: true },
    });
    if (!assignee) return { error: "Μη έγκυρος υπάλληλος" };
  }

  await db.maintenanceRequest.update({ where: { id }, data: { assignedToId: assignee?.id ?? null } });
  if (assignee) {
    await notifyStakeholders({
      requestId: id,
      type: "MAINTENANCE_ASSIGNED",
      title: `Ανάθεση βλάβης: ${req.title}`,
      body: `Η βλάβη ανατέθηκε ${assignee.name ? `στον/στην ${assignee.name}` : "σε υπάλληλο"}.`,
      onlyUserIds: [assignee.id],
    });
  }
  revalidateAll(id, req.buildingId);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Σχόλια (επικοινωνία δύο μεριών)                                     */
/* ------------------------------------------------------------------ */

export async function addRequestComment(id: string, body: string, internal = false) {
  const user = await requireUser();
  if (!body?.trim()) return { error: "Κενό μήνυμα" };
  if (!(await canAccessRequest(user.id, user.role, id))) return { error: "Δεν επιτρέπεται" };
  const req = await db.maintenanceRequest.findUnique({ where: { id }, select: { title: true, buildingId: true } });
  if (!req) return { error: "Δεν βρέθηκε" };

  await db.maintenanceComment.create({
    data: { requestId: id, authorId: user.id, body: body.trim(), internal: internal && isStaff(user.role) },
  });
  if (!internal) {
    await notifyStakeholders({
      requestId: id,
      type: "MAINTENANCE_COMMENT",
      title: `Νέο μήνυμα στη βλάβη «${req.title}»`,
      body: body.trim().slice(0, 300),
      excludeUserId: user.id,
    });
  }
  revalidateAll(id, req.buildingId);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Εκτίμηση διάρκειας & ραντεβού (slots 30')                           */
/* ------------------------------------------------------------------ */

/** Η εταιρία δηλώνει εκτιμώμενη διάρκεια αποκατάστασης + αν χρειάζεται παρουσία διαχειριστή. */
export async function setRequestEstimate(id: string, minutes: number | null, managerPresence: boolean) {
  const user = await requireUser();
  if (!isStaff(user.role)) return { error: "Δεν επιτρέπεται" };
  const req = await db.maintenanceRequest.findUnique({ where: { id }, select: { title: true, buildingId: true } });
  if (!req) return { error: "Δεν βρέθηκε" };
  const mins = minutes && Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes / 30) * 30 || 30 : null;
  await db.maintenanceRequest.update({ where: { id }, data: { estimatedMinutes: mins, managerPresence } });
  await notifyStakeholders({
    requestId: id,
    type: "MAINTENANCE_APPOINTMENT",
    title: `Εκτίμηση αποκατάστασης: ${req.title}`,
    body: mins
      ? `Εκτιμώμενη διάρκεια εργασιών: ${mins} λεπτά.${managerPresence ? " Απαιτείται παρουσία διαχειριστή." : ""}`
      : "Η εκτίμηση διάρκειας αφαιρέθηκε.",
    excludeUserId: user.id,
  });
  revalidateAll(id, req.buildingId);
  return { ok: true };
}

/** Δήλωση διαθέσιμων slots 30' — COMPANY από staff, MANAGER από διαχειριστή/δηλούντα. */
export async function offerSlots(id: string, isoStarts: string[]) {
  const user = await requireUser();
  if (!(await canAccessRequest(user.id, user.role, id))) return { error: "Δεν επιτρέπεται" };
  const side = isStaff(user.role) ? "COMPANY" : "MANAGER";

  const starts = (isoStarts ?? [])
    .map((s) => new Date(s))
    .filter((d) => !isNaN(d.getTime()) && d.getTime() > Date.now());
  if (starts.length === 0) return { error: "Δεν δόθηκαν έγκυρα slots" };
  for (const d of starts) {
    if (d.getMinutes() % 30 !== 0 || d.getSeconds() !== 0) return { error: "Τα slots πρέπει να είναι σε όρια 30 λεπτών" };
  }

  const req = await db.maintenanceRequest.findUnique({ where: { id }, select: { title: true, buildingId: true } });
  if (!req) return { error: "Δεν βρέθηκε" };

  await db.maintenanceSlot.createMany({
    data: starts.map((startAt) => ({ requestId: id, side, startAt, offeredById: user.id })),
    skipDuplicates: true,
  });
  await notifyStakeholders({
    requestId: id,
    type: "MAINTENANCE_APPOINTMENT",
    title: `Νέες διαθεσιμότητες για τη βλάβη «${req.title}»`,
    body: `${side === "COMPANY" ? "Η εταιρία" : "Ο διαχειριστής"} δήλωσε ${starts.length} διαθέσιμα slots για ραντεβού.`,
    excludeUserId: user.id,
  });
  revalidateAll(id, req.buildingId);
  return { ok: true };
}

export async function removeSlot(slotId: string) {
  const user = await requireUser();
  const slot = await db.maintenanceSlot.findUnique({ where: { id: slotId }, select: { id: true, requestId: true, offeredById: true, status: true, request: { select: { buildingId: true } } } });
  if (!slot) return { error: "Δεν βρέθηκε" };
  if (slot.status !== "OPEN") return { error: "Το slot έχει ήδη επιλεγεί" };
  if (slot.offeredById !== user.id && !isStaff(user.role)) return { error: "Δεν επιτρέπεται" };
  await db.maintenanceSlot.delete({ where: { id: slotId } });
  revalidateAll(slot.requestId, slot.request.buildingId);
  return { ok: true };
}

/** Η άλλη πλευρά επιλέγει slot → κλείνει ραντεβού και η βλάβη γίνεται SCHEDULED. */
export async function bookSlot(slotId: string) {
  const user = await requireUser();
  const slot = await db.maintenanceSlot.findUnique({
    where: { id: slotId },
    select: { id: true, requestId: true, side: true, startAt: true, status: true, request: { select: { title: true, estimatedMinutes: true, managerPresence: true, status: true, buildingId: true } } },
  });
  if (!slot || slot.status !== "OPEN") return { error: "Το slot δεν είναι διαθέσιμο" };
  if (!(await canAccessRequest(user.id, user.role, slot.requestId))) return { error: "Δεν επιτρέπεται" };

  const bookerSide = isStaff(user.role) ? "COMPANY" : "MANAGER";
  if (bookerSide === slot.side) return { error: "Το slot το επιλέγει η άλλη πλευρά" };

  const duration = slot.request.estimatedMinutes ?? 60;
  const endAt = new Date(slot.startAt.getTime() + duration * 60_000);

  await db.$transaction([
    db.maintenanceSlot.update({ where: { id: slotId }, data: { status: "SELECTED" } }),
    db.maintenanceAppointment.create({
      data: { requestId: slot.requestId, startAt: slot.startAt, endAt, managerPresence: slot.request.managerPresence, bookedById: user.id },
    }),
    db.maintenanceRequest.update({
      where: { id: slot.requestId },
      data: {
        scheduledDate: slot.startAt,
        ...(STATUS_TRANSITIONS[slot.request.status as FaultStatus]?.includes("SCHEDULED")
          ? { status: "SCHEDULED", statusEvents: { create: { fromStatus: slot.request.status, toStatus: "SCHEDULED", byUserId: user.id, note: "Κλείστηκε ραντεβού" } } }
          : {}),
      },
    }),
  ]);

  const when = slot.startAt.toLocaleString("el-GR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Athens" });
  await notifyStakeholders({
    requestId: slot.requestId,
    type: "MAINTENANCE_APPOINTMENT",
    title: `Ραντεβού για τη βλάβη «${slot.request.title}»`,
    body: `Κλείστηκε ραντεβού: ${when} (διάρκεια ~${duration}').${slot.request.managerPresence ? " Απαιτείται παρουσία διαχειριστή." : ""}`,
  });
  revalidateAll(slot.requestId, slot.request.buildingId);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Ρυθμίσεις: κατηγορίες & κανόνες κάλυψης (μόνο staff εταιρίας)        */
/* ------------------------------------------------------------------ */

async function requireCompanyAdmin() {
  const user = await requireUser();
  if (!["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(user.role)) throw new Error("Forbidden");
  return user;
}

export type CategoryInput = { name: string; icon?: string | null; active?: boolean; sortOrder?: number; slaHours?: number | null; companyResponsible?: boolean };

export async function saveCategory(id: string | null, data: CategoryInput) {
  await requireCompanyAdmin();
  if (!data.name?.trim()) return { error: "Το όνομα είναι υποχρεωτικό" };
  const payload = {
    name: data.name.trim(),
    icon: clean(data.icon),
    active: data.active ?? true,
    sortOrder: Number.isFinite(data.sortOrder) ? Number(data.sortOrder) : 0,
    slaHours: data.slaHours && Number(data.slaHours) > 0 ? Number(data.slaHours) : null,
    companyResponsible: !!data.companyResponsible,
  };
  if (id) await db.maintenanceCategory.update({ where: { id }, data: payload });
  else await db.maintenanceCategory.create({ data: payload });
  revalidatePath("/admin/maintenance/settings");
  return { ok: true };
}

export async function deleteCategory(id: string) {
  await requireCompanyAdmin();
  const used = await db.maintenanceRequest.count({ where: { categoryId: id } });
  if (used > 0) {
    await db.maintenanceCategory.update({ where: { id }, data: { active: false } });
    revalidatePath("/admin/maintenance/settings");
    return { ok: true, deactivated: true };
  }
  await db.maintenanceCategory.delete({ where: { id } });
  revalidatePath("/admin/maintenance/settings");
  return { ok: true };
}

export type CoverageInput = { propertyId?: string | null; categoryId?: string | null; elementLabel?: string | null; covered?: boolean; quantityLimit?: number | null; periodMonths?: number | null; notes?: string | null };

export async function saveCoverageRule(id: string | null, data: CoverageInput) {
  await requireCompanyAdmin();
  const payload = {
    propertyId: clean(data.propertyId),
    categoryId: clean(data.categoryId),
    elementLabel: clean(data.elementLabel),
    covered: data.covered ?? true,
    quantityLimit: data.quantityLimit && Number(data.quantityLimit) > 0 ? Number(data.quantityLimit) : null,
    periodMonths: data.periodMonths && Number(data.periodMonths) > 0 ? Number(data.periodMonths) : null,
    notes: clean(data.notes),
  };
  if (!payload.propertyId && !payload.categoryId) return { error: "Ορίστε ακίνητο ή/και κατηγορία" };
  if (id) await db.maintenanceCoverageRule.update({ where: { id }, data: payload });
  else await db.maintenanceCoverageRule.create({ data: payload });
  revalidatePath("/admin/maintenance/settings");
  return { ok: true };
}

export async function deleteCoverageRule(id: string) {
  await requireCompanyAdmin();
  await db.maintenanceCoverageRule.delete({ where: { id } });
  revalidatePath("/admin/maintenance/settings");
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Ειδοποιήσεις                                                        */
/* ------------------------------------------------------------------ */

export async function markNotificationRead(id: string) {
  const user = await requireUser();
  await db.notification.updateMany({ where: { id, userId: user.id }, data: { readAt: new Date() } });
  return { ok: true };
}

export async function markAllNotificationsRead() {
  const user = await requireUser();
  await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  return { ok: true };
}
