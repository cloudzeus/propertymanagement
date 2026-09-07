import { db } from "@/lib/db";
import { requirePermission } from "@/lib/rbac/permissions";
import { woInclude, workOrderToCompanyDTO } from "@/lib/rfq";
import { WorkOrdersClient } from "./WorkOrdersClient";

export const metadata = { title: "Συμβάσεις έργου" };

export default async function WorkOrdersPage() {
  await requirePermission("work-orders", "view");
  const rows = await db.workOrder.findMany({ include: woInclude, orderBy: { createdAt: "desc" }, take: 500 });
  return <WorkOrdersClient items={rows.map(workOrderToCompanyDTO)} />;
}
