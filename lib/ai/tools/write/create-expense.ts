import { z } from "zod";
import { requireBuildingCap } from "@/lib/building-access";
import { createBuildingExpense as createExpenseAction } from "@/app/actions/building-expenses";
import { getBuildingCategorySplits } from "@/app/actions/expense-categories";
import type { WriteTool } from "../types";
import { resolveBuilding } from "../resolve";
import { STAFF_AND_MANAGER, errMessage, buildingHref, norm } from "./common";

const PM = ["CARD", "CASH", "VIVA", "BANK_TRANSFER", "CHECK", "OTHER"] as const;
const schema = z.object({
  buildingId: z.string().optional(), buildingName: z.string().optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/).describe("Μήνας κοινοχρήστων YYYY-MM"),
  categoryName: z.string().min(2).describe("Κατηγορία εξόδου, π.χ. ΔΕΗ, Ανελκυστήρας, Καθαρισμός"),
  totalAmount: z.number().positive(), netAmount: z.number().nonnegative().optional(), vatAmount: z.number().nonnegative().optional(),
  supplierName: z.string().optional(), supplierVat: z.string().optional(), documentNumber: z.string().optional(),
  documentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), description: z.string().max(500).optional(),
  tenantPct: z.number().min(0).max(100).optional().describe("Ποσοστό ενοικιαστή· κενό = προεπιλογή κατηγορίας"),
  paid: z.boolean().optional(), paymentMethod: z.enum(PM).optional(),
});

export const createBuildingExpense: WriteTool<z.infer<typeof schema>> = {
  name: "createBuildingExpense", kind: "write", roles: STAFF_AND_MANAGER, label: "Δαπάνη κτηρίου",
  description: "Καταχωρεί δαπάνη (έξοδο) κτηρίου χωρίς αρχείο παραστατικού, με κατανομή ενοικιαστή/ιδιοκτήτη από την κατηγορία. Ο χρήστης επιβεβαιώνει πριν την καταχώρηση.",
  schema,
  async preview(args, ctx) {
    const b = await resolveBuilding(ctx, args);
    if ("error" in b) return { error: b.error };
    try { await requireBuildingCap(b.id, "manageExpenses"); } catch { return { error: "Δεν έχετε δικαίωμα καταχώρησης εξόδων σε αυτό το κτήριο" }; }
    const splits = await getBuildingCategorySplits(b.id);
    const needle = norm(args.categoryName);
    const hits = splits.filter((s) => norm(s.category.name).includes(needle));
    if (hits.length === 0) return { error: `Δεν βρέθηκε κατηγορία «${args.categoryName}». Διαθέσιμες: ${splits.map((s) => s.category.name).join(", ")}` };
    if (hits.length > 1) return { error: `Βρήκα ${hits.length} κατηγορίες: ${hits.map((s) => s.category.name).join(", ")}. Ποια εννοείτε;` };
    const cat = hits[0];
    const tenantPct = args.tenantPct ?? cat.effective.tenantPct;
    const ownerPct = 100 - tenantPct;
    const resolved = {
      buildingId: b.id, categoryId: cat.category.id, month: args.month, totalAmount: args.totalAmount, netAmount: args.netAmount ?? null, vatAmount: args.vatAmount ?? null,
      supplierName: args.supplierName ?? null, supplierVat: args.supplierVat ?? null, documentNumber: args.documentNumber ?? null, documentDate: args.documentDate ?? null,
      description: args.description ?? null, tenantPct, paid: !!args.paid, paymentMethod: args.paymentMethod ?? null,
    };
    return {
      title: "Νέα δαπάνη κτηρίου",
      summaryLines: [
        `Κτήριο: ${b.name}`, `Μήνας: ${args.month}`, `Κατηγορία: ${cat.category.name}`, `Ποσό: ${args.totalAmount.toFixed(2)} €`,
        ...(args.supplierName ? [`Προμηθευτής: ${args.supplierName}${args.supplierVat ? ` (ΑΦΜ ${args.supplierVat})` : ""}`] : []),
        ...(args.documentNumber ? [`Παραστατικό: ${args.documentNumber}${args.documentDate ? ` / ${args.documentDate}` : ""}`] : []),
        `Κατανομή: ενοικιαστής ${tenantPct}% / ιδιοκτήτης ${ownerPct}%`, `Πληρωμένο: ${args.paid ? "ναι" : "όχι"}`,
      ],
      warnings: ["Η δαπάνη θα μπει στα κοινόχρηστα του μήνα και θα κατανεμηθεί στις μονάδες."],
      resolved, buildingId: b.id,
    };
  },
  async execute(resolved, ctx) {
    const r = resolved as { buildingId: string; categoryId: string; month: string; totalAmount: number; tenantPct: number } & Record<string, unknown>;
    try {
      await createExpenseAction(r.buildingId, {
        fileId: null, categoryId: r.categoryId, month: r.month, totalAmount: r.totalAmount,
        netAmount: (r.netAmount as number | null) ?? null, vatAmount: (r.vatAmount as number | null) ?? null,
        supplierName: (r.supplierName as string | null) ?? null, supplierVat: (r.supplierVat as string | null) ?? null,
        documentNumber: (r.documentNumber as string | null) ?? null, documentDate: (r.documentDate as string | null) ?? null,
        description: (r.description as string | null) ?? null, tenantPct: r.tenantPct, ownerPct: 100 - r.tenantPct,
        paid: !!r.paid, paymentMethod: (r.paymentMethod as "CARD" | "CASH" | "VIVA" | "BANK_TRANSFER" | "CHECK" | "OTHER" | null) ?? null,
      });
      return { ok: true, message: "Η δαπάνη καταχωρήθηκε.", href: buildingHref(ctx, r.buildingId, "finance") };
    } catch (e) { return { ok: false, error: errMessage(e) }; }
  },
};
