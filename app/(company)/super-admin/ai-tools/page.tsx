import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/rbac/permissions";
import AiToolsClient from "./AiToolsClient";
import { AssistantAdminPanel } from "./AssistantAdminPanel";
import { listAiActions } from "@/app/actions/ai-assistant";

export const metadata = { title: "AI Εργαλεία & APIs — Super Admin" };

export default async function AIToolsPage() {
  await requirePermission("ai-tools", "view");
  const session = await auth();
  if (!session?.user) redirect("/login");
  const me = await db.user.findUnique({ where: { id: session.user.id as string }, select: { role: true } });
  if (me?.role !== "SUPER_ADMIN") redirect("/admin");

  const [actions, chunkCount, embeddedCount] = await Promise.all([
    listAiActions(100),
    db.wikiChunk.count(),
    db.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM "WikiChunk" WHERE "embedding" IS NOT NULL`.then((r) => r[0]?.n ?? 0).catch(() => 0),
  ]);
  return (
    <>
      <AiToolsClient />
      <AssistantAdminPanel actions={actions} chunkCount={chunkCount} embeddedCount={embeddedCount} />
    </>
  );
}
