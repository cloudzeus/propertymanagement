import "server-only";
import { db } from "@/lib/db";
import { listMaintenanceHistory } from "@/app/actions/maintenance-logs";

export type ObligationStatus = "overdue" | "due-soon" | "scheduled" | "none";

export function classifyObligation(nextDueIso: string | null, reminderDaysBefore: number, now: Date): ObligationStatus {
  if (!nextDueIso) return "none";
  const due = new Date(nextDueIso);
  if (due < now) return "overdue";
  const windowMs = Math.max(1, reminderDaysBefore) * 24 * 3600 * 1000;
  if (due.getTime() - now.getTime() <= windowMs) return "due-soon";
  return "scheduled";
}

export type ManagedBuildingRow = {
  id: string; name: string; address: string; customerName: string;
  itemCount: number; totalQuantity: number; scheduleCount: number;
  nextDueDate: string | null; overdueCount: number;
};

export async function listManagedBuildings(): Promise<ManagedBuildingRow[]> {
  const buildings = await db.building.findMany({
    where: { property: { managed: true } },
    orderBy: { name: "asc" },
    select: {
      id: true, name: true, address: true,
      property: { select: { customer: { select: { name: true } } } },
      managedItems: { select: { quantity: true } },
      recurringTasks: { where: { active: true }, select: { nextDueDate: true, reminderDaysBefore: true } },
    },
  });
  const now = new Date();
  return buildings.map((b) => {
    const dues = b.recurringTasks.map((t) => t.nextDueDate).filter((d): d is Date => !!d).sort((x, y) => x.getTime() - y.getTime());
    const overdueCount = b.recurringTasks.filter((t) => classifyObligation(t.nextDueDate?.toISOString() ?? null, t.reminderDaysBefore, now) === "overdue").length;
    return {
      id: b.id, name: b.name, address: b.address,
      customerName: b.property.customer.name,
      itemCount: b.managedItems.length,
      totalQuantity: b.managedItems.reduce((s, m) => s + m.quantity, 0),
      scheduleCount: b.recurringTasks.length,
      nextDueDate: dues[0]?.toISOString() ?? null,
      overdueCount,
    };
  });
}

export type ObligationRow = {
  taskId: string; buildingId: string; buildingName: string; title: string;
  itemName: string | null; nextDueDate: string | null; frequency: string;
  status: ObligationStatus;
};

export async function listUpcomingObligations(): Promise<ObligationRow[]> {
  const tasks = await db.recurringTask.findMany({
    where: { active: true, nextDueDate: { not: null }, building: { property: { managed: true } } },
    orderBy: { nextDueDate: "asc" },
    select: {
      id: true, title: true, frequency: true, nextDueDate: true, reminderDaysBefore: true, buildingId: true,
      building: { select: { name: true } },
      managedItem: { select: { itemType: { select: { name: true } } } },
    },
  });
  const now = new Date();
  return tasks.map((t) => ({
    taskId: t.id, buildingId: t.buildingId, buildingName: t.building.name, title: t.title,
    itemName: t.managedItem?.itemType.name ?? null,
    nextDueDate: t.nextDueDate?.toISOString() ?? null,
    frequency: t.frequency,
    status: classifyObligation(t.nextDueDate?.toISOString() ?? null, t.reminderDaysBefore, now),
  }));
}

export type RecentLogRow = {
  id: string; buildingId: string; buildingName: string; title: string;
  performedAt: string; performedBy: string | null; cost: string | null;
};

export async function listRecentMaintenance(limit = 25): Promise<RecentLogRow[]> {
  const rows = await db.maintenanceLog.findMany({
    where: { building: { property: { managed: true } } },
    orderBy: { performedAt: "desc" },
    take: limit,
    select: {
      id: true, performedAt: true, cost: true, buildingId: true,
      building: { select: { name: true } },
      recurringTask: { select: { title: true } },
      performedBy: { select: { name: true, email: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id, buildingId: r.buildingId, buildingName: r.building.name,
    title: r.recurringTask?.title ?? "—",
    performedAt: r.performedAt.toISOString(),
    performedBy: r.performedBy?.name ?? r.performedBy?.email ?? null,
    cost: r.cost ? r.cost.toString() : null,
  }));
}

export type BuildingDrilldown = {
  items: { id: string; name: string; location: string; quantity: number; scheduleLabel: string | null; nextDueDate: string | null }[];
  history: Awaited<ReturnType<typeof listMaintenanceHistory>>;
};

const FREQ_LABEL: Record<string, string> = { WEEKLY: "Εβδομαδιαία", MONTHLY: "Μηνιαία", QUARTERLY: "Τριμηνιαία", SEMIANNUAL: "Εξαμηνιαία", ANNUAL: "Ετήσια", CUSTOM: "Προσαρμοσμένη" };

export async function getBuildingDrilldown(buildingId: string): Promise<BuildingDrilldown> {
  const items = await db.managedItem.findMany({
    where: { buildingId },
    orderBy: [{ location: "asc" }, { createdAt: "asc" }],
    select: {
      id: true, location: true, quantity: true,
      itemType: { select: { name: true } },
      tasks: { where: { active: true }, orderBy: { nextDueDate: "asc" }, take: 1, select: { frequency: true, nextDueDate: true } },
    },
  });
  const history = await listMaintenanceHistory(buildingId);
  return {
    items: items.map((m) => ({
      id: m.id, name: m.itemType.name, location: m.location, quantity: m.quantity,
      scheduleLabel: m.tasks[0] ? (FREQ_LABEL[m.tasks[0].frequency] ?? m.tasks[0].frequency) : null,
      nextDueDate: m.tasks[0]?.nextDueDate?.toISOString() ?? null,
    })),
    history,
  };
}
