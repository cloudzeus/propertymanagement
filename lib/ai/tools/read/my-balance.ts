import { z } from "zod";
import { getOccupantControlCenter } from "@/lib/building/occupant-data";
import type { ReadTool } from "../types";

const schema = z.object({});
const r2 = (n: number) => Math.round(n * 100) / 100;

export const getMyBalance: ReadTool<z.infer<typeof schema>> = {
  name: "getMyBalance", kind: "read", roles: ["PROPERTY_ADMIN", "PROPERTY_OWNER", "PROPERTY_RESIDENT"], label: "Τα κοινόχρηστά μου",
  description: "Τι οφείλει ο χρήστης σε κοινόχρηστα ανά μονάδα (ανεξόφλητοι μήνες, τελευταίο ειδοποιητήριο). Μόνο για τις δικές του μονάδες.",
  schema,
  async run(_args, ctx) {
    const buildings = [...new Set(ctx.scope.occupantUnits.map((u) => u.buildingId))];
    if (!buildings.length) return { ok: true, data: [], note: "Ο χρήστης δεν έχει μονάδες." };
    const out: unknown[] = [];
    for (const buildingId of buildings) {
      const d = await getOccupantControlCenter(buildingId, ctx.user.id);
      if (!d) continue;
      for (const u of d.statementsByUnit) {
        const unpaid = u.months.filter((m) => !m.settled);
        const last = u.months[0] ?? null;
        out.push({
          building: d.building.name, unitNumber: u.unitNumber, role: u.role,
          due: r2(unpaid.reduce((s, m) => s + m.myPayable, 0)), unpaidMonths: unpaid.map((m) => m.month),
          lastMonth: last?.month ?? null, lastMonthPayable: last ? r2(last.myPayable) : null, lastMonthSettled: last?.settled ?? null,
        });
      }
    }
    return { ok: true, data: out };
  },
};
