import { z } from "zod";
import { db } from "@/lib/db";
import type { ReadTool } from "../types";
import { scopeBuildings } from "../resolve";

const schema = z.object({ q: z.string().max(80).optional().describe("Μέρος του ονόματος/διεύθυνσης για αναζήτηση (μόνο στελέχη)") });

export const listMyBuildings: ReadTool<z.infer<typeof schema>> = {
  name: "listMyBuildings", kind: "read", roles: [], label: "Κτήρια",
  description: "Τα κτήρια που αφορούν τον χρήστη (ένοικος/ιδιοκτήτης/διαχειριστής/συνεργάτης). Τα στελέχη εταιρείας αναζητούν με q. Επιστρέφει έως 20.",
  schema,
  async run(args, ctx) {
    if (ctx.scope.seesAllCustomers) {
      const rows = await db.building.findMany({
        where: args.q ? { OR: [{ name: { contains: args.q, mode: "insensitive" } }, { address: { contains: args.q, mode: "insensitive" } }, { city: { contains: args.q, mode: "insensitive" } }] } : {},
        select: { id: true, name: true, address: true, city: true, property: { select: { name: true, managed: true, customer: { select: { name: true } } } } },
        orderBy: { name: "asc" }, take: 20,
      });
      return { ok: true, data: rows.map((b) => ({ id: b.id, name: b.name, address: `${b.address}, ${b.city}`, property: b.property.name, customer: b.property.customer?.name ?? null, managed: b.property.managed })) };
    }
    if (ctx.user.role === "COLLABORATOR") {
      if (!ctx.scope.supplierId) return { ok: true, data: [] };
      const rows = await db.maintenanceRequest.findMany({ where: { supplierId: ctx.scope.supplierId }, distinct: ["buildingId"], select: { building: { select: { id: true, name: true, address: true, city: true } } }, take: 20 });
      return { ok: true, data: rows.map((r) => ({ id: r.building.id, name: r.building.name, address: `${r.building.address}, ${r.building.city}` })) };
    }
    const list = await scopeBuildings(ctx);
    const roleIn = (id: string) => ctx.scope.managerBuildingIds.includes(id) ? "διαχειριστής" : ctx.scope.occupantUnits.filter((u) => u.buildingId === id).map((u) => `${u.role === "OWNER" ? "ιδιοκτήτης" : "ένοικος"} ${u.unitNumber}`).join(", ");
    return { ok: true, data: list.map((b) => ({ id: b.id, name: b.name, myRole: roleIn(b.id) })) };
  },
};
