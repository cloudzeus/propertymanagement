import { z } from "zod";
import { db } from "@/lib/db";
import type { ReadTool } from "../types";
import { resolveBuilding } from "../resolve";

const schema = z.object({ buildingId: z.string().optional(), buildingName: z.string().optional(), limit: z.number().int().min(1).max(20).optional() });
const excerpt = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200);

export const listAnnouncements: ReadTool<z.infer<typeof schema>> = {
  name: "listAnnouncements", kind: "read", roles: [], label: "Ανακοινώσεις",
  description: "Ανακοινώσεις ενός κτηρίου (οι πιο πρόσφατες). Ένοικοι/ιδιοκτήτες βλέπουν μόνο όσες τους στάλθηκαν.",
  schema,
  async run(args, ctx) {
    const b = await resolveBuilding(ctx, args);
    if ("error" in b) return { ok: false, error: b.error };
    const occupant = !ctx.scope.seesAllCustomers && !ctx.scope.managerBuildingIds.includes(b.id);
    // Announcements sent to several buildings carry buildingId = null; they are found through their targets instead.
    const building = await db.building.findUnique({ where: { id: b.id }, select: { propertyId: true } });
    const myUnitIds = ctx.scope.occupantUnits.filter((u) => u.buildingId === b.id).map((u) => u.unitId);
    const targetScopes: Record<string, unknown>[] = [{ scopeType: "BUILDING", scopeId: b.id }];
    if (building?.propertyId) targetScopes.push({ scopeType: "PROPERTY", scopeId: building.propertyId });
    if (myUnitIds.length) targetScopes.push({ scopeType: "UNIT", scopeId: { in: myUnitIds } });
    const rows = await db.announcement.findMany({
      where: {
        status: { not: "DRAFT" },
        OR: [{ buildingId: b.id }, { buildingId: null, targets: { some: { OR: targetScopes } } }],
        ...(occupant ? { recipients: { some: { userId: ctx.user.id } } } : {}),
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }], take: args.limit ?? 10,
      select: { id: true, title: true, content: true, publishedAt: true, createdAt: true, audience: true },
    });
    return { ok: true, data: rows.map((a) => ({ id: a.id, title: a.title, audience: a.audience, publishedAt: (a.publishedAt ?? a.createdAt).toISOString().slice(0, 10), excerpt: excerpt(a.content) })) };
  },
};
