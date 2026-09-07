import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getEffectiveSession } from "@/lib/auth-effective";
import { buildingDeciderIds } from "@/lib/notify";
import { renderContract } from "@/lib/contracts";
import { ContractView } from "@/components/contracts/ContractView";

export const metadata = { title: "Σύμβαση έργου" };

/** Customer side (A) of the contract — only the building's deciders (and staff) may open it. */
export default async function CustomerContractPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const eff = await getEffectiveSession();
  if (!eff) redirect("/login");
  const wo = await db.workOrder.findUnique({ where: { id }, select: { buildingId: true, customerContractHtml: true, maintenanceRequestId: true, number: true } });
  if (!wo) notFound();
  const staff = ["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(eff.user.role);
  if (!staff && !(await buildingDeciderIds(wo.buildingId)).includes(eff.user.id)) redirect("/unauthorized");
  const live = await renderContract("WO_CUSTOMER", id);
  return <ContractView title={live.title} html={wo.customerContractHtml ?? live.html} frozen={!!wo.customerContractHtml} backHref={wo.maintenanceRequestId ? `/portal/maintenance/${wo.maintenanceRequestId}` : "/building"} backLabel={`Πίσω (${wo.number})`} />;
}
