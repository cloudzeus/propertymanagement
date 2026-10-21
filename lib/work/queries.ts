import "server-only";
import { db } from "@/lib/db";
import { getEffectiveSession } from "@/lib/auth-effective";
import type { WorkItem } from "./types";
import { computeKpis, type WorkKpis } from "./kpis";
import { customerIdsForScope, type WorkScope } from "./scope";
import { faultToWorkItem, workOrderToWorkItem, rfqToWorkItem, programmeToWorkItem, appointmentToWorkItem } from "./normalize";

export type { WorkScope } from "./scope";

const DAY = 24 * 3600_000;
/** Per-source cap; each query is ordered most-urgent-first so a hit cap drops the least urgent rows. */
const TAKE = 500;

/** Customer ids a MANAGER is account manager of (null = no restriction). */
export async function managedCustomerIds(userId: string, role: string): Promise<string[] | null> {
  if (role !== "MANAGER") return null;
  const mine = await db.customer.findMany({ where: { accountManagerId: userId }, select: { id: true } });
  return customerIdsForScope(role, mine.map((c) => c.id));
}

export async function resolveWorkScope(): Promise<WorkScope> {
  const eff = await getEffectiveSession();
  if (!eff) throw new Error("Unauthorized");
  const role = eff.user.role as string;
  const userId = eff.user.id as string;
  return { role, userId, customerIds: await managedCustomerIds(userId, role) };
}

/** Every pending item across the company (or the manager's customers), overdue first. */
export async function loadWorkItems(scope: WorkScope, now: Date = new Date()): Promise<WorkItem[]> {
  const buildingScope = scope.customerIds ? { customerId: { in: scope.customerIds } } : {};
  const soon = new Date(now.getTime() + 30 * DAY);

  const [faults, workOrders, rfqs, tasks, appointments] = await Promise.all([
    db.maintenanceRequest.findMany({
      where: { status: { notIn: ["COMPLETED", "CANCELLED"] }, building: buildingScope },
      orderBy: [{ slaDueAt: { sort: "asc", nulls: "last" } }, { updatedAt: "desc" }],
      take: TAKE,
      select: {
        id: true, title: true, description: true, status: true, priority: true, handledBy: true, slaDueAt: true, updatedAt: true, buildingId: true,
        building: { select: { name: true, property: { select: { customer: { select: { name: true } } } } } },
        categoryRef: { select: { name: true } }, assignedTo: { select: { id: true, name: true } }, supplier: { select: { name: true } },
        supplierId: true,
        serviceRequests: { where: { status: { in: ["OPEN", "OFFERED"] } }, select: { id: true, offers: { where: { status: "SUBMITTED" }, select: { id: true } } } },
        workOrders: { where: { status: { notIn: ["DECLINED", "CANCELLED"] } }, orderBy: { createdAt: "desc" }, take: 1, select: { id: true, status: true } },
        _count: { select: { appointments: true } },
      },
    }),
    db.workOrder.findMany({
      where: { status: { notIn: ["CONFIRMED", "DECLINED", "CANCELLED"] }, building: buildingScope },
      orderBy: [{ scheduledAt: { sort: "asc", nulls: "last" } }, { validUntil: { sort: "asc", nulls: "last" } }, { updatedAt: "desc" }],
      take: TAKE,
      select: {
        id: true, number: true, title: true, description: true, status: true, scheduledAt: true, validUntil: true, updatedAt: true, buildingId: true,
        building: { select: { name: true } }, customer: { select: { name: true } }, supplier: { select: { name: true } }, maintenanceRequestId: true,
      },
    }),
    db.serviceRequest.findMany({
      where: { status: { in: ["OPEN", "OFFERED", "FORWARDED"] }, building: buildingScope },
      orderBy: [{ deadlineAt: { sort: "asc", nulls: "last" } }, { updatedAt: "desc" }],
      take: TAKE,
      select: {
        id: true, title: true, description: true, status: true, deadlineAt: true, updatedAt: true, buildingId: true,
        building: { select: { name: true } }, maintenanceRequestId: true, _count: { select: { offers: true } },
        offers: { where: { status: "SUBMITTED" }, select: { id: true } },
        workOrders: { where: { status: { notIn: ["DECLINED", "CANCELLED"] } }, select: { id: true } },
      },
    }),
    db.recurringTask.findMany({
      where: { active: true, nextDueDate: { not: null, lte: soon }, building: { ...buildingScope, property: { managed: true } } },
      orderBy: [{ nextDueDate: "asc" }, { updatedAt: "desc" }],
      take: TAKE,
      select: {
        id: true, title: true, notes: true, nextDueDate: true, updatedAt: true, buildingId: true, vendor: true,
        building: { select: { name: true } }, supplier: { select: { name: true } }, managedItem: { select: { itemType: { select: { name: true } } } },
      },
    }),
    db.maintenanceAppointment.findMany({
      where: {
        status: "CONFIRMED",
        startAt: { gte: new Date(now.getTime() - DAY), lte: new Date(now.getTime() + 14 * DAY) },
        request: { status: { notIn: ["COMPLETED", "CANCELLED"] }, building: buildingScope },
      },
      orderBy: [{ startAt: "asc" }],
      take: TAKE,
      select: {
        id: true, startAt: true, endAt: true, managerPresence: true,
        request: { select: { id: true, title: true, buildingId: true, building: { select: { name: true } }, assignedTo: { select: { id: true, name: true } } } },
      },
    }),
  ]);

  const items: WorkItem[] = [];
  for (const r of faults) { const w = faultToWorkItem(r, now); if (w) items.push(w); }
  for (const r of workOrders) { const w = workOrderToWorkItem(r, now); if (w) items.push(w); }
  for (const r of rfqs) { const w = rfqToWorkItem(r, now); if (w) items.push(w); }
  for (const r of tasks) { const w = programmeToWorkItem(r, now); if (w) items.push(w); }
  for (const r of appointments) items.push(appointmentToWorkItem(r, now));

  return items.sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    if (a.dueAt && b.dueAt && a.dueAt !== b.dueAt) return a.dueAt < b.dueAt ? -1 : 1;
    if (!!a.dueAt !== !!b.dueAt) return a.dueAt ? -1 : 1;
    return a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0;
  });
}

export async function loadWorkSummary(scope: WorkScope): Promise<WorkKpis> {
  const now = new Date();
  return computeKpis(await loadWorkItems(scope, now), now);
}

/** Support tickets raised in the last `days` — a counter only; status lives in the external ticketing. */
export async function countRecentSupportTickets(days = 30): Promise<number> {
  if (!process.env.TICKETING_URL) return 0;
  return db.supportTicket.count({ where: { createdAt: { gte: new Date(Date.now() - days * DAY) } } });
}

/** Company people a fault can be assigned to (mirrors assignRequest's validation). */
export async function listAssignableEmployees(): Promise<{ id: string; name: string }[]> {
  const rows = await db.user.findMany({
    where: { role: { in: ["EMPLOYEE", "MANAGER", "ADMIN"] }, status: "ACTIVE" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true },
  });
  return rows.map((u) => ({ id: u.id, name: u.name ?? u.email }));
}
