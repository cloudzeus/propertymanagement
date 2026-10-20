import { z } from "zod";
import { requireBuildingCap } from "@/lib/building-access";
import { createRecurringTask as createTaskAction } from "@/app/actions/recurring-tasks";
import type { WriteTool } from "../types";
import { resolveBuilding } from "../resolve";
import { STAFF_AND_MANAGER, errMessage, buildingHref } from "./common";

const FREQ = ["WEEKLY", "MONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL"] as const;
const FREQ_LABEL: Record<string, string> = { WEEKLY: "κάθε εβδομάδα", MONTHLY: "κάθε μήνα", QUARTERLY: "κάθε τρίμηνο", SEMIANNUAL: "κάθε εξάμηνο", ANNUAL: "κάθε χρόνο" };
const KINDS = ["GENERAL", "ELEVATOR", "BOILER", "FIRE_SAFETY", "HVAC", "ELECTRICAL", "PLUMBING", "OTHER"] as const;
const schema = z.object({
  buildingId: z.string().optional(), buildingName: z.string().optional(),
  title: z.string().min(3).max(150), frequency: z.enum(FREQ), nextDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  kind: z.enum(KINDS).optional(), vendor: z.string().max(120).optional(), notes: z.string().max(1000).optional(),
  reminderDaysBefore: z.number().int().min(0).max(90).optional(),
});

export const createRecurringTask: WriteTool<z.infer<typeof schema>> = {
  name: "createRecurringTask", kind: "write", roles: STAFF_AND_MANAGER, label: "Εργασία συντήρησης",
  description: "Προσθέτει επαναλαμβανόμενη εργασία συντήρησης στο ημερολόγιο ενός κτηρίου (π.χ. συντήρηση ανελκυστήρα κάθε μήνα). Ο χρήστης επιβεβαιώνει πριν την καταχώρηση.",
  schema,
  async preview(args, ctx) {
    const b = await resolveBuilding(ctx, args);
    if ("error" in b) return { error: b.error };
    try { await requireBuildingCap(b.id, "manageCalendar"); } catch { return { error: "Δεν έχετε δικαίωμα στο ημερολόγιο αυτού του κτηρίου" }; }
    return {
      title: "Νέα εργασία συντήρησης",
      summaryLines: [
        `Κτήριο: ${b.name}`, `Τίτλος: ${args.title.trim()}`, `Συχνότητα: ${FREQ_LABEL[args.frequency]}`,
        `Επόμενη ημερομηνία: ${args.nextDueDate ?? "—"}`, ...(args.vendor ? [`Συνεργείο: ${args.vendor}`] : []),
        `Υπενθύμιση: ${args.reminderDaysBefore ?? 7} ημέρες πριν`,
      ],
      warnings: [],
      resolved: { buildingId: b.id, title: args.title.trim(), frequency: args.frequency, nextDueDate: args.nextDueDate ?? null, kind: args.kind ?? "GENERAL", vendor: args.vendor ?? null, notes: args.notes ?? null, reminderDaysBefore: args.reminderDaysBefore ?? 7 },
      buildingId: b.id,
    };
  },
  async execute(resolved, ctx) {
    const { buildingId, ...data } = resolved as { buildingId: string } & Parameters<typeof createTaskAction>[1];
    try {
      const r = await createTaskAction(buildingId, data);
      if ("error" in r && r.error) return { ok: false, error: r.error };
      return { ok: true, message: "Η εργασία προστέθηκε στο ημερολόγιο.", href: buildingHref(ctx, buildingId, "maintenance") };
    } catch (e) { return { ok: false, error: errMessage(e) }; }
  },
};
