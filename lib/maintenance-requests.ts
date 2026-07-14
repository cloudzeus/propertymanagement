import { db } from "@/lib/db";
import { sendNotificationEmail } from "@/lib/mailgun";
import type { FaultPriority } from "@/lib/maintenance-shared";

export { FAULT_STATUSES, STATUS_LABELS, STATUS_TRANSITIONS, FAULT_PRIORITIES, PRIORITY_LABELS, HANDLER_LABELS } from "@/lib/maintenance-shared";
export type { FaultStatus, FaultPriority } from "@/lib/maintenance-shared";

/* ------------------------------------------------------------------ */
/* SLA                                                                 */
/* ------------------------------------------------------------------ */

const PRIORITY_SLA_FACTOR: Record<FaultPriority, number> = { URGENT: 0.5, HIGH: 0.75, NORMAL: 1, LOW: 1.5 };

export function computeSlaDueAt(slaHours: number | null | undefined, priority: FaultPriority, from: Date = new Date()): Date | null {
  if (!slaHours) return null;
  const hours = slaHours * (PRIORITY_SLA_FACTOR[priority] ?? 1);
  return new Date(from.getTime() + hours * 3600_000);
}

/* ------------------------------------------------------------------ */
/* Responsibility resolution (managed contract coverage)               */
/* ------------------------------------------------------------------ */

/**
 * Ποιος είναι υπεύθυνος για την επίλυση: COMPANY ή PROPERTY_ADMIN.
 * - Μη-managed property → πάντα PROPERTY_ADMIN.
 * - Managed: ψάχνουμε κανόνα κάλυψης με σειρά ειδικότητας:
 *   (property+category) → (property, χωρίς category) → (global+category) → default κατηγορίας.
 * - Ποσοτικό όριο: αν ο κανόνας έχει quantityLimit, μετράμε πόσες βλάβες της
 *   κατηγορίας ανέλαβε η εταιρία στο ακίνητο μέσα στην περίοδο· αν εξαντλήθηκε → PROPERTY_ADMIN.
 */
export async function resolveResponsibility(buildingId: string, categoryId: string | null): Promise<"COMPANY" | "PROPERTY_ADMIN"> {
  const building = await db.building.findUnique({
    where: { id: buildingId },
    select: { propertyId: true, property: { select: { managed: true } } },
  });
  if (!building?.property?.managed) return "PROPERTY_ADMIN";

  const rules = await db.maintenanceCoverageRule.findMany({
    where: {
      OR: [
        { propertyId: building.propertyId, categoryId: categoryId ?? undefined },
        { propertyId: building.propertyId, categoryId: null },
        { propertyId: null, categoryId: categoryId ?? undefined },
      ],
    },
  });
  const pick =
    rules.find((r) => r.propertyId === building.propertyId && r.categoryId && r.categoryId === categoryId) ??
    rules.find((r) => r.propertyId === building.propertyId && !r.categoryId) ??
    rules.find((r) => !r.propertyId && r.categoryId && r.categoryId === categoryId);

  let covered: boolean;
  let quantityLimit: number | null = null;
  let periodMonths = 12;
  if (pick) {
    covered = pick.covered;
    quantityLimit = pick.quantityLimit;
    periodMonths = pick.periodMonths ?? 12;
  } else if (categoryId) {
    const cat = await db.maintenanceCategory.findUnique({ where: { id: categoryId }, select: { companyResponsible: true } });
    covered = cat?.companyResponsible ?? false;
  } else {
    covered = false;
  }
  if (!covered) return "PROPERTY_ADMIN";

  if (quantityLimit != null) {
    const since = new Date();
    since.setMonth(since.getMonth() - periodMonths);
    const used = await db.maintenanceRequest.count({
      where: {
        handledBy: "COMPANY",
        categoryId: categoryId ?? undefined,
        createdAt: { gte: since },
        status: { not: "CANCELLED" },
        building: { propertyId: building.propertyId },
      },
    });
    if (used >= quantityLimit) return "PROPERTY_ADMIN";
  }
  return "COMPANY";
}

/* ------------------------------------------------------------------ */
/* Stakeholders & notifications (in-app + email)                       */
/* ------------------------------------------------------------------ */

type Recipient = { id: string; email: string | null };

/** Όλοι οι ενδιαφερόμενοι μιας βλάβης: δηλών, ανατεθειμένος, διαχειριστές κτηρίου/ακινήτου, και (αν COMPANY) στελέχη εταιρίας. */
export async function getStakeholders(requestId: string): Promise<Recipient[]> {
  const req = await db.maintenanceRequest.findUnique({
    where: { id: requestId },
    select: {
      reportedById: true,
      assignedToId: true,
      handledBy: true,
      building: {
        select: {
          id: true,
          propertyId: true,
          property: { select: { companyId: true, customer: { select: { accountManagerId: true } } } },
          managementAssignments: { select: { userId: true } },
        },
      },
    },
  });
  if (!req) return [];

  const ids = new Set<string>();
  if (req.reportedById) ids.add(req.reportedById);
  if (req.assignedToId) ids.add(req.assignedToId);
  req.building.managementAssignments.forEach((a) => ids.add(a.userId));
  // Υπεύθυνος manager του πελάτη — ενημερώνεται πάντα για τα ακίνητα των πελατών του.
  if (req.building.property?.customer?.accountManagerId) ids.add(req.building.property.customer.accountManagerId);
  const propAssignments = await db.managementAssignment.findMany({
    where: { propertyId: req.building.propertyId },
    select: { userId: true },
  });
  propAssignments.forEach((a) => ids.add(a.userId));

  if (req.handledBy === "COMPANY" && req.building.property?.companyId) {
    const staff = await db.user.findMany({
      where: { companyId: req.building.property.companyId, role: { in: ["ADMIN", "MANAGER"] }, status: "ACTIVE" },
      select: { id: true },
    });
    staff.forEach((u) => ids.add(u.id));
  }

  if (ids.size === 0) return [];
  return db.user.findMany({ where: { id: { in: [...ids] } }, select: { id: true, email: true } });
}

/**
 * Ενημέρωση ενδιαφερομένων: γράφει Notification rows (καμπανάκι/dashboard)
 * και στέλνει email. Τα emails φεύγουν best-effort (δεν μπλοκάρουν σε σφάλμα).
 */
export async function notifyStakeholders(opts: {
  requestId: string;
  type: string; // MAINTENANCE_STATUS | MAINTENANCE_COMMENT | MAINTENANCE_ASSIGNED | MAINTENANCE_APPOINTMENT
  title: string;
  body?: string;
  excludeUserId?: string | null; // μην ειδοποιείς αυτόν που έκανε την ενέργεια
  onlyUserIds?: string[]; // περιορισμός σε συγκεκριμένους παραλήπτες
}) {
  let recipients = await getStakeholders(opts.requestId);
  if (opts.onlyUserIds) recipients = recipients.filter((r) => opts.onlyUserIds!.includes(r.id));
  if (opts.excludeUserId) recipients = recipients.filter((r) => r.id !== opts.excludeUserId);
  if (recipients.length === 0) return;

  const roles = await db.user.findMany({ where: { id: { in: recipients.map((r) => r.id) } }, select: { id: true, role: true } });
  const roleOf = new Map(roles.map((u) => [u.id, u.role as string]));
  const hrefFor = (userId: string) => {
    const role = roleOf.get(userId);
    if (["SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE"].includes(role ?? "")) return `/admin/maintenance/${opts.requestId}`;
    if (role === "PROPERTY_ADMIN") return `/portal/maintenance/${opts.requestId}`;
    return `/portal/requests/${opts.requestId}`;
  };

  await db.notification.createMany({
    data: recipients.map((r) => ({
      userId: r.id,
      type: opts.type,
      title: opts.title,
      body: opts.body ?? null,
      href: hrefFor(r.id),
      requestId: opts.requestId,
    })),
  });

  // Emails: best effort, χωρίς να ρίχνουν το action.
  void Promise.allSettled(
    recipients
      .filter((r) => r.email)
      .map((r) => sendNotificationEmail(r.email!, opts.title, opts.body ?? opts.title)),
  );
}

/** Πρόσβαση χρήστη στη βλάβη: staff εταιρίας, διαχειριστής κτηρίου/ακινήτου, δηλών, ή ένοικος/ιδιοκτήτης της μονάδας. */
export async function canAccessRequest(userId: string, role: string, requestId: string): Promise<boolean> {
  if (["SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE"].includes(role)) return true;
  const req = await db.maintenanceRequest.findUnique({
    where: { id: requestId },
    select: { reportedById: true, buildingId: true, unitId: true, building: { select: { propertyId: true } } },
  });
  if (!req) return false;
  if (req.reportedById === userId) return true;
  const assignment = await db.managementAssignment.findFirst({
    where: { userId, OR: [{ buildingId: req.buildingId }, { propertyId: req.building.propertyId }] },
    select: { id: true },
  });
  if (assignment) return true;
  if (req.unitId) {
    const occ = await db.unitOccupancy.findFirst({ where: { unitId: req.unitId, userId, endDate: null }, select: { id: true } });
    if (occ) return true;
    const unit = await db.unit.findFirst({ where: { id: req.unitId, OR: [{ ownerId: userId }, { residentId: userId }] }, select: { id: true } });
    if (unit) return true;
  }
  return false;
}

/* ------------------------------------------------------------------ */
/* DTO loader για τις σελίδες λεπτομέρειας                             */
/* ------------------------------------------------------------------ */

export async function loadFaultDetail(id: string) {
  const r = await db.maintenanceRequest.findUnique({
    where: { id },
    include: {
      building: { select: { name: true } },
      unit: { select: { unitNumber: true, floor: true } },
      categoryRef: { select: { name: true } },
      reportedBy: { select: { name: true, email: true } },
      assignedTo: { select: { name: true } },
      attachments: { orderBy: { createdAt: "asc" } },
      comments: { orderBy: { createdAt: "asc" }, include: { author: { select: { id: true, name: true } } } },
      statusEvents: { orderBy: { createdAt: "desc" }, include: { byUser: { select: { name: true } } } },
      slots: { orderBy: { startAt: "asc" }, include: { offeredBy: { select: { name: true } } } },
      appointments: { orderBy: { startAt: "desc" } },
    },
  });
  if (!r) return null;
  const iso = (d: Date | null) => (d ? d.toISOString() : null);
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    status: r.status,
    priority: r.priority,
    handledBy: r.handledBy,
    categoryName: r.categoryRef?.name ?? r.category ?? null,
    buildingName: r.building.name,
    unitLabel: r.unit ? `Μονάδα ${r.unit.unitNumber}` : null,
    reporterName: r.reportedBy?.name ?? r.reportedBy?.email ?? null,
    assigneeName: r.assignedTo?.name ?? null,
    slaDueAt: iso(r.slaDueAt),
    scheduledDate: iso(r.scheduledDate),
    createdAt: r.createdAt.toISOString(),
    completedAt: iso(r.completedAt),
    restrictedAccess: r.restrictedAccess,
    managerPresence: r.managerPresence,
    estimatedMinutes: r.estimatedMinutes,
    attachments: r.attachments.map((a) => ({ id: a.id, url: a.url, kind: a.kind })),
    comments: r.comments.map((c) => ({ id: c.id, body: c.body, internal: c.internal, authorName: c.author?.name ?? null, authorId: c.author?.id ?? null, createdAt: c.createdAt.toISOString() })),
    events: r.statusEvents.map((e) => ({ id: e.id, fromStatus: e.fromStatus, toStatus: e.toStatus, note: e.note, byName: e.byUser?.name ?? null, createdAt: e.createdAt.toISOString() })),
    slots: r.slots.map((s) => ({ id: s.id, side: s.side, startAt: s.startAt.toISOString(), status: s.status, offeredByName: s.offeredBy?.name ?? null })),
    appointments: r.appointments.map((a) => ({ id: a.id, startAt: a.startAt.toISOString(), endAt: a.endAt.toISOString(), status: a.status, managerPresence: a.managerPresence })),
  };
}
