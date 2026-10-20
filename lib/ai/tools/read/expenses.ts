import { z } from "zod";
import { requireBuildingCap } from "@/lib/building-access";
import { listBuildingExpenses } from "@/app/actions/building-expenses";
import { ACCESS_DENIED, type ReadTool } from "../types";
import { resolveBuilding } from "../resolve";

const schema = z.object({ buildingId: z.string().optional(), buildingName: z.string().optional(), month: z.string().regex(/^\d{4}-\d{2}$/).optional().describe("YYYY-MM") });

export const listExpenses: ReadTool<z.infer<typeof schema>> = {
  name: "listExpenses", kind: "read", roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE", "PROPERTY_ADMIN"], label: "Δαπάνες κτηρίου",
  description: "Δαπάνες (έξοδα) ενός κτηρίου, προαιρετικά για έναν μήνα YYYY-MM. Μόνο για στελέχη και διαχειριστές με δικαίωμα οικονομικών.",
  schema,
  async run(args, ctx) {
    const b = await resolveBuilding(ctx, args);
    if ("error" in b) return { ok: false, error: b.error };
    try { await requireBuildingCap(b.id, "viewLedger"); } catch { return { ok: false, error: ACCESS_DENIED }; }
    const rows = (await listBuildingExpenses(b.id)).filter((e) => !args.month || e.month === args.month).slice(0, 20);
    return { ok: true, data: rows.map((e) => ({ id: e.id, month: e.month, category: e.categoryName, supplier: e.supplierName, amount: e.amount, paid: e.paid, documentNumber: e.documentNumber, description: e.description })) };
  },
};
