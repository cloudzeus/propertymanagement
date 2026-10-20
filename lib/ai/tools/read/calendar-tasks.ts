import { z } from "zod";
import { db } from "@/lib/db";
import { requireBuildingView } from "@/lib/building-access";
import { ACCESS_DENIED, type ReadTool } from "../types";
import { resolveBuilding } from "../resolve";

const schema = z.object({ buildingId: z.string().optional(), buildingName: z.string().optional() });
const FREQ: Record<string, string> = { WEEKLY: "εβδομαδιαία", MONTHLY: "μηνιαία", QUARTERLY: "τριμηνιαία", SEMIANNUAL: "εξαμηνιαία", ANNUAL: "ετήσια", CUSTOM: "προσαρμοσμένη" };

export const listCalendarTasks: ReadTool<z.infer<typeof schema>> = {
  name: "listCalendarTasks", kind: "read", roles: [], label: "Πρόγραμμα συντηρήσεων",
  description: "Προγραμματισμένες/επαναλαμβανόμενες συντηρήσεις ενός κτηρίου με την επόμενη ημερομηνία.",
  schema,
  async run(args, ctx) {
    const b = await resolveBuilding(ctx, args);
    if ("error" in b) return { ok: false, error: b.error };
    // Collaborators are authorized by resolveBuilding (their supplier's job sites); the view guard knows nothing about suppliers.
    if (ctx.user.role !== "COLLABORATOR") { try { await requireBuildingView(b.id); } catch { return { ok: false, error: ACCESS_DENIED }; } }
    const rows = await db.recurringTask.findMany({ where: { buildingId: b.id, active: true }, orderBy: { nextDueDate: "asc" }, take: 20, select: { id: true, title: true, frequency: true, nextDueDate: true, kind: true, vendor: true } });
    return { ok: true, data: rows.map((t) => ({ id: t.id, title: t.title, frequency: FREQ[t.frequency] ?? t.frequency, nextDueDate: t.nextDueDate ? t.nextDueDate.toISOString().slice(0, 10) : null, kind: t.kind, vendor: t.vendor })) };
  },
};
