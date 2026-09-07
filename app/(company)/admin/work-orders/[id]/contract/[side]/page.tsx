import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/rbac/permissions";
import { renderContract } from "@/lib/contracts";
import { ContractView } from "@/components/contracts/ContractView";

export const metadata = { title: "Σύμβαση έργου" };

/** Company staff: either side of the back-to-back contract. */
export default async function AdminContractPage({ params }: { params: Promise<{ id: string; side: string }> }) {
  const { id, side } = await params;
  await requirePermission("work-orders", "view");
  const key = side === "supplier" ? "WO_SUPPLIER" : "WO_CUSTOMER";
  const wo = await db.workOrder.findUnique({ where: { id }, select: { customerContractHtml: true, supplierContractHtml: true, maintenanceRequestId: true, number: true } });
  if (!wo) notFound();
  const frozen = key === "WO_SUPPLIER" ? wo.supplierContractHtml : wo.customerContractHtml;
  const live = await renderContract(key, id);
  return <ContractView title={live.title} html={frozen ?? live.html} frozen={!!frozen} backHref={wo.maintenanceRequestId ? `/admin/maintenance/${wo.maintenanceRequestId}` : "/admin/work-orders"} backLabel={`Πίσω (${wo.number})`} />;
}
