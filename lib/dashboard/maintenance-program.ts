import "server-only";
import { db } from "@/lib/db";
import { expandOccurrences, type TaskFrequency } from "@/lib/dashboard/maintenance-calendar";
import { rankSuppliers, describeRank } from "@/lib/supplier-ranking";

export type ProgrammeOccurrence = { date: string; requestId: string | null; requestStatus: string | null };
export type ProgrammeRow = {
  taskId: string; title: string; kind: string; frequency: string; active: boolean;
  buildingId: string; buildingName: string; customerName: string; managed: boolean;
  itemName: string | null; inServicePackage: boolean;
  supplierId: string | null; supplierName: string | null; vendor: string | null;
  nextDueDate: string | null; lastDoneDate: string | null;
  /** occurrences in the selected year, with the fault opened for each (if any) */
  occurrences: ProgrammeOccurrence[];
  /** top ranked suggestions for this building (same-supplier continuity first) */
  suggestions: { id: string; name: string; label: string }[];
};

/**
 * Annual maintenance programme: every active recurring task projected over a
 * calendar year, joined with the faults already opened from it and with a
 * ranked supplier suggestion (preferred → same as last time → rating → distance).
 */
export async function loadMaintenanceProgramme(year: number, buildingId?: string | null): Promise<{ rows: ProgrammeRow[]; buildings: { id: string; name: string }[]; suppliers: { id: string; name: string }[] }> {
  const from = new Date(year, 0, 1);
  const to = new Date(year, 11, 31, 23, 59, 59);
  const [tasks, suppliers, buildings] = await Promise.all([
    db.recurringTask.findMany({
      where: { active: true, ...(buildingId ? { buildingId } : {}) },
      orderBy: [{ building: { name: "asc" } }, { nextDueDate: "asc" }],
      select: {
        id: true, title: true, kind: true, frequency: true, active: true, nextDueDate: true, lastDoneDate: true, vendor: true, inServicePackage: true,
        supplierId: true, supplier: { select: { name: true } },
        managedItem: { select: { itemType: { select: { name: true } } } },
        building: { select: { id: true, name: true, lat: true, lng: true, property: { select: { managed: true, customer: { select: { name: true } } } } } },
        requests: { where: { createdAt: { gte: from, lte: to } }, select: { id: true, status: true, scheduledDate: true, createdAt: true } },
      },
    }),
    db.supplier.findMany({
      where: { customerId: null, isPlatform: false, isActive: true },
      select: { id: true, name: true, lat: true, lng: true, ratingAvg: true, ratingCount: true, emergency24h: true, onboardedAt: true, categories: { select: { categoryId: true } } },
    }),
    db.building.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  // "same supplier as last time" per building — from any past fault with a supplier
  const usedRows = await db.maintenanceRequest.findMany({ where: { supplierId: { not: null }, buildingId: { in: [...new Set(tasks.map((t) => t.building.id))] } }, distinct: ["buildingId", "supplierId"], select: { buildingId: true, supplierId: true } });
  const usedBy = new Map<string, Set<string>>();
  for (const u of usedRows) { if (!usedBy.has(u.buildingId)) usedBy.set(u.buildingId, new Set()); usedBy.get(u.buildingId)!.add(u.supplierId!); }
  const preferredRows = await db.buildingPreferredSupplier.findMany({ where: { categoryId: null }, select: { buildingId: true, supplierId: true } });
  const preferredBy = new Map(preferredRows.map((p) => [p.buildingId, p.supplierId]));

  const rows: ProgrammeRow[] = tasks.map((t) => {
    const dates = expandOccurrences(t.nextDueDate, t.frequency as TaskFrequency, from, to);
    const occurrences: ProgrammeOccurrence[] = dates.map((d) => {
      // match a fault opened for the same month
      const hit = t.requests.find((r) => { const rd = r.scheduledDate ?? r.createdAt; return rd.getFullYear() === d.getFullYear() && rd.getMonth() === d.getMonth(); });
      return { date: d.toISOString(), requestId: hit?.id ?? null, requestStatus: hit?.status ?? null };
    });
    const used = usedBy.get(t.building.id) ?? new Set<string>();
    const preferred = preferredBy.get(t.building.id) ?? t.supplierId;
    const ranked = rankSuppliers(
      suppliers.map((s) => ({
        id: s.id, name: s.name, lat: s.lat, lng: s.lng, ratingAvg: s.ratingAvg, ratingCount: s.ratingCount, emergency24h: s.emergency24h,
        categoryIds: s.categories.map((c) => c.categoryId), preferred: s.id === preferred, lastUsedHere: used.has(s.id) || s.id === t.supplierId, onboarded: !!s.onboardedAt,
      })),
      { categoryId: null, lat: t.building.lat, lng: t.building.lng, priority: "NORMAL" },
    ).slice(0, 5);
    return {
      taskId: t.id, title: t.title, kind: t.kind, frequency: t.frequency, active: t.active,
      buildingId: t.building.id, buildingName: t.building.name, customerName: t.building.property.customer.name, managed: t.building.property.managed,
      itemName: t.managedItem?.itemType.name ?? null, inServicePackage: t.inServicePackage,
      supplierId: t.supplierId, supplierName: t.supplier?.name ?? null, vendor: t.vendor,
      nextDueDate: t.nextDueDate?.toISOString() ?? null, lastDoneDate: t.lastDoneDate?.toISOString() ?? null,
      occurrences,
      suggestions: ranked.map((r) => ({ id: r.id, name: r.name, label: describeRank(r) })),
    };
  });
  return { rows, buildings, suppliers: suppliers.map((s) => ({ id: s.id, name: s.name })) };
}
