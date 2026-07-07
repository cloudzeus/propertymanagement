import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/rbac/permissions";
import AiToolsClient from "./AiToolsClient";

export const metadata = { title: "AI Tools & APIs — Super Admin" };

export default async function AIToolsPage() {
  await requirePermission("ai-tools", "view");
  const session = await auth();
  if (!session?.user) redirect("/login");
  const me = await db.user.findUnique({ where: { id: session.user.id as string }, select: { role: true } });
  if (me?.role !== "SUPER_ADMIN") redirect("/admin");

  return <AiToolsClient />;
}
