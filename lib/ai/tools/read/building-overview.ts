import { z } from "zod";
import { db } from "@/lib/db";
import { getBuildingAccess } from "@/lib/building-access";
import { ACCESS_DENIED, type ReadTool } from "../types";
import { resolveBuilding } from "../resolve";

const schema = z.object({ buildingId: z.string().optional(), buildingName: z.string().optional() });

export const getBuildingOverview: ReadTool<z.infer<typeof schema>> = {
  name: "getBuildingOverview", kind: "read", roles: [], label: "Στοιχεία κτηρίου",
  description: "Βασικά στοιχεία ενός κτηρίου (διεύθυνση, όροφοι, ανελκυστήρας, πλήθος μονάδων, αν το διαχειρίζεται η εταιρεία). Χρειάζεται buildingId ή buildingName· αλλιώς το κτήριο της σελίδας.",
  schema,
  async run(args, ctx) {
    const b = await resolveBuilding(ctx, args);
    if ("error" in b) return { ok: false, error: b.error };
    // resolveBuilding already authorized the id; getBuildingAccess only decides what a collaborator (no access row) may not see.
    const access = await getBuildingAccess(ctx.user.id, b.id);
    if (!access && ctx.user.role !== "COLLABORATOR") return { ok: false, error: ACCESS_DENIED };
    const row = await db.building.findUnique({
      where: { id: b.id },
      select: { id: true, name: true, address: true, city: true, postalCode: true, floors: true, hasElevator: true, property: { select: { name: true, managed: true } }, _count: { select: { units: true } } },
    });
    if (!row) return { ok: false, error: ACCESS_DENIED };
    const data: Record<string, unknown> = {
      id: row.id, name: row.name, address: row.address, city: row.city, postalCode: row.postalCode, floors: row.floors, hasElevator: row.hasElevator,
      managed: row.property.managed, propertyName: row.property.name, unitsCount: row._count.units,
    };
    if (access && access.viewer !== "occupant") {
      const mgrs = await db.managementAssignment.findMany({ where: { buildingId: row.id }, select: { user: { select: { name: true } } } });
      data.managerNames = mgrs.map((m) => m.user.name).filter(Boolean);
    }
    return { ok: true, data };
  },
};
