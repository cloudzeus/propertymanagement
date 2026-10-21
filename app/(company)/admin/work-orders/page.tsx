import { db } from "@/lib/db";
import { requirePermission, getEffectivePermissions } from "@/lib/rbac/permissions";
import { getEffectiveSession } from "@/lib/auth-effective";
import { workActionViewer } from "@/lib/work/scope";
import { woInclude, workOrderToCompanyDTO } from "@/lib/rfq";
import { WorkOrdersClient } from "./WorkOrdersClient";

export const metadata = { title: "Συμβάσεις έργου" };

export default async function WorkOrdersPage() {
  await requirePermission("work-orders", "view");
  const [eff, resolved, rows] = await Promise.all([getEffectiveSession(), getEffectivePermissions(), db.workOrder.findMany({ include: woInclude, orderBy: { createdAt: "desc" }, take: 500 })]);
  const viewer = workActionViewer(eff!.user.role as string, eff!.user.id as string, resolved?.perms ?? new Set());
  return <WorkOrdersClient items={rows.map(workOrderToCompanyDTO)} viewer={viewer} />;
}
