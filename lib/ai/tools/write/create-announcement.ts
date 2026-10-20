import { z } from "zod";
import { requireBuildingCap } from "@/lib/building-access";
import { createAnnouncement as createAnnouncementAction, listAnnouncementTargets } from "@/app/actions/announcements";
import type { WriteTool } from "../types";
import { resolveBuilding } from "../resolve";
import { STAFF_AND_MANAGER, toParagraphs, errMessage, buildingHref } from "./common";

const AUD = { ALL: "όλους (ιδιοκτήτες & ένοικοι)", OWNERS: "ιδιοκτήτες", RESIDENTS: "ένοικους" } as const;
const schema = z.object({
  buildingId: z.string().optional(), buildingName: z.string().optional(),
  title: z.string().min(3).max(150), content: z.string().min(5).max(4000).describe("Απλό κείμενο· νέες γραμμές = παράγραφοι"),
  audience: z.enum(["ALL", "OWNERS", "RESIDENTS"]),
});

export const createAnnouncement: WriteTool<z.infer<typeof schema>> = {
  name: "createAnnouncement", kind: "write", roles: STAFF_AND_MANAGER, label: "Ανακοίνωση",
  description: "Στέλνει ανακοίνωση (εφαρμογή + email) στους ιδιοκτήτες/ένοικους ενός κτηρίου. Ο χρήστης επιβεβαιώνει πριν την αποστολή.",
  schema,
  async preview(args, ctx) {
    const b = await resolveBuilding(ctx, args);
    if ("error" in b) return { error: b.error };
    try { await requireBuildingCap(b.id, "manageAnnouncements"); } catch { return { error: "Δεν έχετε δικαίωμα ανακοινώσεων σε αυτό το κτήριο" }; }
    const people = await listAnnouncementTargets(b.id);
    const count = people.filter((p) => args.audience === "ALL" || (args.audience === "OWNERS" ? p.roles.includes("OWNER") : p.roles.includes("RESIDENT"))).length;
    return {
      title: "Νέα ανακοίνωση",
      summaryLines: [`Κτήριο: ${b.name}`, `Προς: ${AUD[args.audience]}`, `Θέμα: ${args.title.trim()}`, `Κείμενο: ${args.content.trim()}`],
      warnings: [`Θα σταλεί email σε ${count} παραλήπτες.`],
      resolved: { buildingId: b.id, title: args.title.trim(), content: toParagraphs(args.content), audience: args.audience },
      buildingId: b.id,
    };
  },
  async execute(resolved, ctx) {
    const r = resolved as { buildingId: string; title: string; content: string; audience: "ALL" | "OWNERS" | "RESIDENTS" };
    try {
      const res = await createAnnouncementAction({ title: r.title, content: r.content, audience: r.audience, targets: [{ scopeType: "BUILDING", scopeId: r.buildingId }], publishedAt: new Date().toISOString() });
      if (res && "error" in res && res.error) return { ok: false, error: String(res.error) };
      return { ok: true, message: "Η ανακοίνωση στάλθηκε.", href: ctx.surface === "company" ? "/admin/announcements" : buildingHref(ctx, r.buildingId, "communication") };
    } catch (e) { return { ok: false, error: errMessage(e) }; }
  },
};
