import { z } from "zod";
import { db } from "@/lib/db";
import { createRfq as createRfqAction } from "@/app/actions/rfq";
import type { WriteTool } from "../types";
import { resolveRequest } from "../resolve";
import { errMessage } from "./common";

const schema = z.object({
  requestId: z.string().optional(), requestTitle: z.string().optional(),
  supplierNames: z.array(z.string().min(1)).min(1).describe("Ονόματα συνεργατών από το μητρώο της εταιρείας"),
  deadlineAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), surveyRequired: z.boolean().optional(), notes: z.string().max(1000).optional(),
});

export const createRfq: WriteTool<z.infer<typeof schema>> = {
  name: "createRfq", kind: "write", roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"], requiredPerm: "suppliers:edit", label: "Αίτημα προσφοράς",
  description: "Στέλνει αίτημα προσφοράς (RFQ) για μια βλάβη σε συνεργάτες του μητρώου. Ο χρήστης επιβεβαιώνει πριν την αποστολή.",
  schema,
  async preview(args, ctx) {
    const req = await resolveRequest(ctx, args);
    if ("error" in req) return { error: req.error };
    const supplierIds: string[] = [], names: string[] = [];
    for (const name of args.supplierNames) {
      const rows = await db.supplier.findMany({ where: { customerId: null, isPlatform: false, isActive: true, name: { contains: name.trim(), mode: "insensitive" } }, select: { id: true, name: true }, take: 5 });
      if (rows.length === 0) return { error: `Δεν βρέθηκε ενεργός συνεργάτης «${name}» στο μητρώο.` };
      if (rows.length > 1) return { error: `Το «${name}» ταιριάζει σε ${rows.length} συνεργάτες: ${rows.map((r) => r.name).join(", ")}. Ποιον εννοείτε;` };
      supplierIds.push(rows[0].id); names.push(rows[0].name);
    }
    return {
      title: "Αίτημα προσφοράς",
      summaryLines: [`Βλάβη: ${req.name}`, `Συνεργάτες: ${names.join(", ")}`, `Προθεσμία: ${args.deadlineAt ?? "—"}`, `Αυτοψία: ${args.surveyRequired ? "ναι" : "όχι"}`, ...(args.notes ? [`Σημειώσεις: ${args.notes}`] : [])],
      warnings: [`Θα ειδοποιηθούν ${supplierIds.length} συνεργάτες.`],
      resolved: { maintenanceRequestId: req.id, supplierIds, deadlineAt: args.deadlineAt ? `${args.deadlineAt}T23:59:00` : null, surveyRequired: !!args.surveyRequired, notes: args.notes ?? null },
      buildingId: null,
    };
  },
  async execute(resolved) {
    const r = resolved as Parameters<typeof createRfqAction>[0];
    try {
      const res = await createRfqAction(r);
      if ("error" in res && res.error) return { ok: false, error: res.error };
      return { ok: true, message: "Το αίτημα προσφοράς στάλθηκε.", href: `/admin/maintenance/${r.maintenanceRequestId}` };
    } catch (e) { return { ok: false, error: errMessage(e) }; }
  },
};
