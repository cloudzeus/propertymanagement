import "server-only";
import { db } from "@/lib/db";

export type TaskFrequency = "WEEKLY" | "MONTHLY" | "QUARTERLY" | "SEMIANNUAL" | "ANNUAL" | "CUSTOM";

export type MaintenanceCalEvent = {
  id: string;            // synthetic: `${taskId}@${isoDate}`
  taskId: string;
  buildingId: string;
  buildingName: string;
  title: string;
  kind: string;
  itemName: string | null;
  date: string;          // ISO
  overdue: boolean;
};

const MAX_OCCURRENCES = 500;

function step(date: Date, freq: TaskFrequency): Date {
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

/**
 * Project a recurring task's occurrences that fall within [from, to].
 * If `nextDueDate` is before `from`, include exactly that one overdue occurrence,
 * then step forward into the window. CUSTOM = the single date only.
 */
export function expandOccurrences(nextDueDate: Date | null, freq: TaskFrequency, from: Date, to: Date): Date[] {
  if (!nextDueDate) return [];
  const out: Date[] = [];
  if (freq === "CUSTOM") {
    if (nextDueDate <= to) out.push(new Date(nextDueDate));
    return out;
  }
  let cursor = new Date(nextDueDate);
  if (cursor < from) {
    out.push(new Date(cursor));
    while (cursor < from && out.length < MAX_OCCURRENCES) cursor = step(cursor, freq);
  }
  while (cursor <= to && out.length < MAX_OCCURRENCES) {
    out.push(new Date(cursor));
    cursor = step(cursor, freq);
  }
  return out;
}

/** All maintenance occurrences across managed buildings within [from, to]. */
export async function listMaintenanceCalendar(from: Date, to: Date): Promise<MaintenanceCalEvent[]> {
  const tasks = await db.recurringTask.findMany({
    where: { active: true, nextDueDate: { not: null }, building: { property: { managed: true } } },
    select: {
      id: true, title: true, frequency: true, nextDueDate: true, kind: true, buildingId: true,
      building: { select: { name: true } },
      managedItem: { select: { itemType: { select: { name: true } } } },
    },
  });
  const now = new Date();
  const events: MaintenanceCalEvent[] = [];
  for (const t of tasks) {
    const dates = expandOccurrences(t.nextDueDate, t.frequency as TaskFrequency, from, to);
    for (const d of dates) {
      const iso = d.toISOString();
      events.push({
        id: `${t.id}@${iso}`,
        taskId: t.id,
        buildingId: t.buildingId,
        buildingName: t.building.name,
        title: t.title,
        kind: t.kind,
        itemName: t.managedItem?.itemType.name ?? null,
        date: iso,
        overdue: d < now,
      });
    }
  }
  return events;
}
