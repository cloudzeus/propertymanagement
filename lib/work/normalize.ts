/**
 * Pure mappers: selected Prisma rows → WorkItem. Each accepts only the fields
 * the work center needs so tests can feed plain objects.
 */
import { WORK_PRIORITIES, type WorkItem, type WorkPriority, type WorkStage } from "./types";
import { EMPTY_FLAGS, type FaultFlags } from "./actions";

export type FaultRow = {
  id: string; title: string; description: string; status: string; priority: string; handledBy: string;
  slaDueAt: Date | null; updatedAt: Date; buildingId: string;
  building: { name: string; property?: { customer?: { name: string } | null } | null };
  categoryRef?: { name: string } | null;
  assignedTo?: { id: string; name: string | null } | null;
  supplier?: { name: string } | null;
  supplierId?: string | null;
  /** open (OPEN/OFFERED) RFQs with their SUBMITTED offers */
  serviceRequests?: { id: string; offers: { id: string }[] }[];
  /** newest-first work orders whose status ∉ {DECLINED, CANCELLED} */
  workOrders?: { id: string; status: string }[];
  _count?: { appointments: number };
};
export type WorkOrderRow = {
  id: string; number: string; title: string; description: string; status: string;
  scheduledAt: Date | null; validUntil: Date | null; updatedAt: Date; buildingId: string;
  building: { name: string }; customer: { name: string }; supplier: { name: string };
  maintenanceRequestId: string | null;
};
export type RfqRow = {
  id: string; title: string; description: string; status: string; deadlineAt: Date | null; updatedAt: Date;
  buildingId: string; building: { name: string }; maintenanceRequestId: string | null; _count: { offers: number };
  /** SUBMITTED offers */
  offers?: { id: string }[];
  /** work orders whose status ∉ {DECLINED, CANCELLED} */
  workOrders?: { id: string }[];
};
export type ProgrammeRow = {
  id: string; title: string; notes: string | null; nextDueDate: Date | null; updatedAt: Date; buildingId: string;
  building: { name: string }; supplier?: { name: string } | null; vendor: string | null;
  managedItem?: { itemType: { name: string } } | null;
};
export type AppointmentRow = {
  id: string; startAt: Date; endAt: Date; managerPresence: boolean;
  request: { id: string; title: string; buildingId: string; building: { name: string }; assignedTo?: { id: string; name: string | null } | null };
};

const FAULT_STAGE: Record<string, WorkStage> = { OPEN: "new", ACKNOWLEDGED: "triage", SCHEDULED: "scheduled", IN_PROGRESS: "in-progress", ON_HOLD: "on-hold" };
const WO_STAGE: Record<string, WorkStage> = { PENDING_CUSTOMER: "waiting-customer", ACCEPTED: "triage", SCHEDULED: "scheduled", IN_PROGRESS: "in-progress", COMPLETED: "awaiting-confirmation", DISPUTED: "on-hold" };
const RFQ_STAGE: Record<string, WorkStage> = { OPEN: "new", OFFERED: "triage", FORWARDED: "waiting-customer" };

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
const isOverdue = (due: Date | null | undefined, now: Date) => !!due && due.getTime() < now.getTime();
const priorityOf = (p: string): WorkPriority => ((WORK_PRIORITIES as readonly string[]).includes(p) ? (p as WorkPriority) : "NORMAL");
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const hhmm = (d: Date) => d.toLocaleTimeString("el-GR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/Athens" });

/** Light per-row facts the action menu needs; relations are optional so older callers keep working. */
export function faultFlags(r: Pick<FaultRow, "serviceRequests" | "workOrders" | "_count">): FaultFlags {
  const rfq = r.serviceRequests?.[0];
  const wo = r.workOrders?.[0];
  if (!rfq && !wo && !r._count?.appointments) return EMPTY_FLAGS;
  return {
    openRfqId: rfq?.id ?? null,
    offersToForward: (r.serviceRequests ?? []).reduce((n, q) => n + q.offers.length, 0),
    liveWo: wo ? { id: wo.id, status: wo.status } : null,
    hasAppointment: (r._count?.appointments ?? 0) > 0,
  };
}

export function faultToWorkItem(r: FaultRow, now: Date): WorkItem | null {
  const stage = FAULT_STAGE[r.status];
  if (!stage) return null;
  return {
    id: `fault:${r.id}`, source: "fault", sourceId: r.id,
    title: r.title, subtitle: r.categoryRef?.name ?? null,
    buildingId: r.buildingId, buildingName: r.building.name, customerName: r.building.property?.customer?.name ?? null,
    stage, rawStatus: r.status, priority: priorityOf(r.priority),
    dueAt: iso(r.slaDueAt), overdue: isOverdue(r.slaDueAt, now),
    assigneeId: r.assignedTo?.id ?? null, assigneeName: r.assignedTo?.name ?? null,
    supplierName: r.supplier?.name ?? null,
    handledBy: r.handledBy === "COMPANY" ? "COMPANY" : "PROPERTY_ADMIN",
    href: `/admin/maintenance/${r.id}`, updatedAt: r.updatedAt.toISOString(), description: r.description || null,
    supplierId: r.supplierId ?? null, flags: faultFlags(r),
  };
}

export function workOrderToWorkItem(r: WorkOrderRow, now: Date): WorkItem | null {
  const stage = WO_STAGE[r.status];
  if (!stage) return null;
  const due = r.scheduledAt ?? r.validUntil ?? null;
  return {
    id: `wo:${r.id}`, source: "work-order", sourceId: r.id,
    title: r.title, subtitle: r.number,
    buildingId: r.buildingId, buildingName: r.building.name, customerName: r.customer.name,
    stage, rawStatus: r.status, priority: null,
    dueAt: iso(due), overdue: isOverdue(due, now),
    assigneeId: null, assigneeName: null, supplierName: r.supplier.name, handledBy: null,
    href: `/admin/work-orders/${r.id}`, faultId: r.maintenanceRequestId,
    updatedAt: r.updatedAt.toISOString(), description: r.description || null,
  };
}

export function rfqToWorkItem(r: RfqRow, now: Date): WorkItem | null {
  const stage = RFQ_STAGE[r.status];
  if (!stage) return null;
  return {
    id: `rfq:${r.id}`, source: "rfq", sourceId: r.id,
    title: r.title, subtitle: plural(r._count.offers, "προσφορά", "προσφορές"),
    buildingId: r.buildingId, buildingName: r.building.name, customerName: null,
    stage, rawStatus: r.status, priority: null,
    dueAt: iso(r.deadlineAt), overdue: isOverdue(r.deadlineAt, now),
    assigneeId: null, assigneeName: null, supplierName: null, handledBy: null,
    href: r.maintenanceRequestId ? `/admin/maintenance/${r.maintenanceRequestId}` : "/admin/maintenance", faultId: r.maintenanceRequestId,
    updatedAt: r.updatedAt.toISOString(), description: r.description || null,
    rfq: { offersToForward: r.offers?.length ?? 0, hasLiveWorkOrder: (r.workOrders?.length ?? 0) > 0 },
  };
}

export function programmeToWorkItem(r: ProgrammeRow, now: Date): WorkItem | null {
  if (!r.nextDueDate) return null;
  const overdue = isOverdue(r.nextDueDate, now);
  return {
    id: `programme:${r.id}`, source: "programme", sourceId: r.id,
    title: r.title, subtitle: r.managedItem?.itemType.name ?? r.vendor ?? null,
    buildingId: r.buildingId, buildingName: r.building.name, customerName: null,
    stage: overdue ? "overdue-programme" : "scheduled", rawStatus: overdue ? "OVERDUE" : "SCHEDULED", priority: null,
    dueAt: r.nextDueDate.toISOString(), overdue,
    assigneeId: null, assigneeName: null, supplierName: r.supplier?.name ?? r.vendor ?? null, handledBy: null,
    href: `/admin/maintenance-program?building=${r.buildingId}`,
    updatedAt: r.updatedAt.toISOString(), description: r.notes,
  };
}

export function appointmentToWorkItem(r: AppointmentRow, now: Date): WorkItem {
  const range = `${hhmm(r.startAt)}–${hhmm(r.endAt)}`;
  return {
    id: `appt:${r.id}`, source: "appointment", sourceId: r.id,
    title: r.request.title, subtitle: r.managerPresence ? `${range} · παρουσία διαχειριστή` : range,
    buildingId: r.request.buildingId, buildingName: r.request.building.name, customerName: null,
    stage: "scheduled", rawStatus: "CONFIRMED", priority: null,
    dueAt: r.startAt.toISOString(), overdue: isOverdue(r.startAt, now),
    assigneeId: r.request.assignedTo?.id ?? null, assigneeName: r.request.assignedTo?.name ?? null,
    supplierName: null, handledBy: null,
    href: `/admin/maintenance/${r.request.id}`, updatedAt: r.startAt.toISOString(), description: null,
  };
}
