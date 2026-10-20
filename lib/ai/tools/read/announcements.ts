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
    const rows = await db.announcement.findMany({
      where: { buildingId: b.id, status: { not: "DRAFT" }, ...(occupant ? { recipients: { some: { userId: ctx.user.id } } } : {}) },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }], take: args.limit ?? 10,
      select: { id: true, title: true, content: true, publishedAt: true, createdAt: true, audience: true },
    });
    return { ok: true, data: rows.map((a) => ({ id: a.id, title: a.title, audience: a.audience, publishedAt: (a.publishedAt ?? a.createdAt).toISOString().slice(0, 10), excerpt: excerpt(a.content) })) };
  },
};
