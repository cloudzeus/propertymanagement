import { z } from "zod";
import { db } from "@/lib/db";
import { FAULT_PRIORITIES, PRIORITY_LABELS, type FaultPriority } from "@/lib/maintenance-shared";
import { resolveResponsibility } from "@/lib/maintenance-requests";
import { createMaintenanceRequest } from "@/app/actions/maintenance-requests";
import type { WriteTool } from "../types";
import { resolveBuilding, hrefForFault } from "../resolve";
import { norm } from "./common";

const schema = z.object({
  buildingId: z.string().optional(), buildingName: z.string().optional(),
  unitNumber: z.string().optional().describe("Αριθμός διαμερίσματος/μονάδας· κενό = κοινόχρηστος χώρος"),
  title: z.string().min(3).max(120), description: z.string().min(5).max(2000),
  category: z.string().optional().describe("Κατηγορία βλάβης, π.χ. Υδραυλικά, Ηλεκτρολογικά, Ανελκυστήρας"),
  priority: z.enum(FAULT_PRIORITIES).optional(), restrictedAccess: z.boolean().optional().describe("Χρειάζεται ραντεβού για πρόσβαση στη μονάδα"),
});

export const createFaultReport: WriteTool<z.infer<typeof schema>> = {
  name: "createFaultReport", kind: "write", roles: [], label: "Δήλωση βλάβης",
  description: "Δηλώνει νέα βλάβη/αίτημα σε κτήριο (προαιρετικά σε συγκεκριμένη μονάδα). Ο χρήστης επιβεβαιώνει πριν την καταχώρηση.",
  schema,
  async preview(args, ctx) {
    const b = await resolveBuilding(ctx, args);
    if ("error" in b) return { error: b.error };
    let unitId: string | null = null, unitLabel = "Κοινόχρηστος χώρος";
    if (args.unitNumber?.trim()) {
      const wanted = norm(args.unitNumber);
      const mine = ctx.scope.occupantUnits.filter((u) => u.buildingId === b.id);
      const isManagerOrStaff = ctx.scope.seesAllCustomers || ctx.scope.managerBuildingIds.includes(b.id);
      if (!isManagerOrStaff) {
        const own = mine.find((u) => norm(u.unitNumber) === wanted);
        if (!own) return { error: `Μπορείτε να δηλώσετε βλάβη μόνο για τις δικές σας μονάδες (${mine.map((u) => u.unitNumber).join(", ") || "καμία"}) ή για κοινόχρηστο χώρο.` };
        unitId = own.unitId; unitLabel = `Μονάδα ${own.unitNumber}`;
      } else {
        const u = await db.unit.findFirst({ where: { buildingId: b.id, unitNumber: { equals: args.unitNumber.trim(), mode: "insensitive" } }, select: { id: true, unitNumber: true } });
        if (!u) return { error: `Δεν βρέθηκε μονάδα «${args.unitNumber}» στο κτήριο ${b.name}.` };
        unitId = u.id; unitLabel = `Μονάδα ${u.unitNumber}`;
      }
    }
    let categoryId: string | null = null, categoryName = "Γενικά";
    if (args.category?.trim()) {
      // Exact name wins; otherwise a contains-match must be unique (same contract as create-expense), never a silent first hit.
      const cats = await db.maintenanceCategory.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } });
      const needle = norm(args.category);
      const exact = cats.filter((c) => norm(c.name) === needle);
      const hits = exact.length ? exact : cats.filter((c) => norm(c.name).includes(needle));
      if (hits.length === 0) return { error: `Δεν βρέθηκε κατηγορία «${args.category.trim()}». Διαθέσιμες: ${cats.map((c) => c.name).join(", ")}` };
      if (hits.length > 1) return { error: `Βρήκα ${hits.length} κατηγορίες: ${hits.map((c) => c.name).join(", ")}. Ποια εννοείτε;` };
      categoryId = hits[0].id; categoryName = hits[0].name;
    }
    const priority: FaultPriority = args.priority ?? "NORMAL";
    const handledBy = await resolveResponsibility(b.id, categoryId);
    return {
      title: "Δήλωση βλάβης",
      summaryLines: [
        `Κτήριο: ${b.name}`, `Θέση: ${unitLabel}`, `Τίτλος: ${args.title.trim()}`, `Περιγραφή: ${args.description.trim()}`,
        `Κατηγορία: ${categoryName}`, `Προτεραιότητα: ${PRIORITY_LABELS[priority]}`,
        `Αναλαμβάνει: ${handledBy === "COMPANY" ? "η εταιρεία διαχείρισης" : "ο διαχειριστής του κτηρίου"}`,
        ...(args.restrictedAccess ? ["Χρειάζεται ραντεβού για πρόσβαση"] : []),
      ],
      warnings: ["Θα ειδοποιηθούν οι υπεύθυνοι του κτηρίου."],
      resolved: { buildingId: b.id, unitId, title: args.title.trim(), description: args.description.trim(), categoryId, priority, restrictedAccess: !!args.restrictedAccess },
      buildingId: b.id,
    };
  },
  async execute(resolved, ctx) {
    const r = await createMaintenanceRequest(resolved as Parameters<typeof createMaintenanceRequest>[0]);
    if ("error" in r && r.error) return { ok: false, error: r.error };
    const id = (r as { id: string }).id;
    return { ok: true, message: "Η βλάβη δηλώθηκε.", href: hrefForFault(ctx, id) };
  },
};
