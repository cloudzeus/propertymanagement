import { z } from "zod";
import { retrieveWiki } from "@/lib/ai/assistant/retrieval";
import type { ReadTool } from "../types";

const schema = z.object({ query: z.string().min(2).max(300) });

export const searchWiki: ReadTool<z.infer<typeof schema>> = {
  name: "searchWiki", kind: "read", roles: [], label: "Αναζήτηση στον οδηγό",
  description: "Αναζητά στον οδηγό χρήσης (wiki) της εφαρμογής: πώς γίνεται κάτι, πού βρίσκεται μια λειτουργία. Επιστρέφει αποσπάσματα με τη σελίδα (route) που αφορούν.",
  schema,
  async run(args, ctx) {
    const hits = await retrieveWiki(args.query, ctx.user.role, 5, { userId: ctx.user.id, customerId: ctx.user.customerId ?? undefined });
    return { ok: true, data: hits.map((h) => ({ title: h.title, heading: h.heading, route: h.route, excerpt: h.content.slice(0, 600) })) };
  },
};
