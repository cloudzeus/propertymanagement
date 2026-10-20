import { z } from "zod";
import { db } from "@/lib/db";
import { getBuildingAccess } from "@/lib/building-access";
import { FAULT_STATUSES, STATUS_LABELS, type FaultStatus } from "@/lib/maintenance-shared";
import { ACCESS_DENIED, type ReadTool } from "../types";
import { hrefForFault } from "../resolve";

const schema = z.object({
  buildingId: z.string().optional().describe("Περιορισμός σε ένα κτήριο"),
  status: z.enum(FAULT_STATUSES).optional(),
  limit: z.number().int().min(1).max(20).optional(),
});

export const listFaults: ReadTool<z.infer<typeof schema>> = {
  name: "listFaults", kind: "read", roles: [], label: "Βλάβες",
  description: "Βλάβες/αιτήματα που αφορούν τον χρήστη (δικά του, του κτηρίου του, ή ανατεθειμένα στον συνεργάτη). Φίλτρα: buildingId, status (OPEN, ACKNOWLEDGED, SCHEDULED, IN_PROGRESS, ON_HOLD, COMPLETED, CANCELLED).",
  schema,
  async run(args, ctx) {
    const role = ctx.user.role;
    let where: Record<string, unknown>;
    if (args.buildingId) {
      if (!(await getBuildingAccess(ctx.user.id, args.buildingId))) return { ok: false, error: ACCESS_DENIED };
    }
    if (ctx.scope.seesAllCustomers) {
      where = {};
    } else if (role === "COLLABORATOR") {
      if (!ctx.scope.supplierId) return { ok: true, data: [] };
      where = { supplierId: ctx.scope.supplierId };
    } else {
      // Managed buildings (managers only) + own reports + common-area faults of the buildings the user occupies.
      const myBuildings = [...new Set(ctx.scope.occupantUnits.map((u) => u.buildingId))];
      const or: Record<string, unknown>[] = [];
      if (role === "PROPERTY_ADMIN") or.push({ buildingId: { in: ctx.scope.managerBuildingIds } });
      or.push({ reportedById: ctx.user.id }, { buildingId: { in: myBuildings }, unitId: null });
      where = { OR: or };
    }
    if (args.buildingId) where.buildingId = args.buildingId;
    if (args.status) where.status = args.status;
    const rows = await db.maintenanceRequest.findMany({
      where, orderBy: { createdAt: "desc" }, take: args.limit ?? 20,
      select: { id: true, title: true, status: true, priority: true, createdAt: true, handledBy: true, building: { select: { name: true } }, unit: { select: { unitNumber: true } } },
    });
    return {
      ok: true,
      data: rows.map((r) => ({
        id: r.id, title: r.title, status: r.status, statusLabel: STATUS_LABELS[r.status as FaultStatus] ?? r.status, priority: r.priority,
        building: r.building.name, unit: r.unit?.unitNumber ?? null, handledBy: r.handledBy, createdAt: r.createdAt.toISOString().slice(0, 10), href: hrefForFault(ctx, r.id),
      })),
    };
  },
};
