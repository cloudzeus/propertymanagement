import { z } from "zod";
import type { ReadTool } from "../types";
import { loadWorkItems, managedCustomerIds } from "@/lib/work/queries";
import { applyFilters } from "@/lib/work/kpis";
import { SOURCE_LABELS, STAGE_LABELS, WORK_SOURCES, type WorkSource } from "@/lib/work/types";

const schema = z.object({
  source: z.enum(WORK_SOURCES as [WorkSource, ...WorkSource[]]).optional().describe("fault | work-order | rfq | programme | appointment"),
  onlyMine: z.boolean().optional().describe("Μόνο οι εργασίες που είναι ανατεθειμένες στον χρήστη (ή αδιάθετες ευθύνης εταιρείας)"),
  overdueOnly: z.boolean().optional(),
  limit: z.number().int().min(1).max(20).optional(),
});

/** Company-side read tool over the work center loader (same scope rules as /admin/work). */
export const listPendingWork: ReadTool<z.infer<typeof schema>> = {
  name: "listPendingWork", kind: "read", roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE"], requiredPerm: "work:view", label: "Εκκρεμείς εργασίες",
  description: "Εκκρεμείς εργασίες της εταιρείας (βλάβες, συμβάσεις έργου, αιτήματα προσφοράς, πρόγραμμα συντηρήσεων, ραντεβού), εκπρόθεσμες πρώτα. Φίλτρα: source, onlyMine, overdueOnly.",
  schema,
  async run(args, ctx) {
    const scope = { role: ctx.user.role, userId: ctx.user.id, customerIds: await managedCustomerIds(ctx.user.id, ctx.user.role) };
    const items = applyFilters(await loadWorkItems(scope, ctx.now), {
      source: args.source ? [args.source] : undefined,
      mine: args.onlyMine,
      f: args.overdueOnly ? "overdue" : undefined,
    }, { now: ctx.now, userId: ctx.user.id });
    return {
      ok: true,
      data: items.slice(0, args.limit ?? 20).map((w) => ({
        id: w.id, source: SOURCE_LABELS[w.source], title: w.title, subtitle: w.subtitle, building: w.buildingName,
        stage: STAGE_LABELS[w.stage], priority: w.priority, dueAt: w.dueAt ? w.dueAt.slice(0, 10) : null, overdue: w.overdue,
        assignee: w.assigneeName, supplier: w.supplierName, href: w.href,
      })),
      note: items.length > (args.limit ?? 20) ? `Εμφανίζονται ${args.limit ?? 20} από ${items.length}. Όλες: /admin/work` : undefined,
    };
  },
};
