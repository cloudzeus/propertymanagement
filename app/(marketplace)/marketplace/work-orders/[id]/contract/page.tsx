import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireCollaborator } from "@/lib/marketplace";
import { UnlinkedNotice } from "@/components/marketplace/UnlinkedNotice";
import { renderContract } from "@/lib/contracts";
import { ContractView } from "@/components/contracts/ContractView";

export const metadata = { title: "Σύμβαση έργου" };

/** Supplier side (B) of the contract. */
export default async function SupplierContractPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireCollaborator("mkt-work-orders");
  if (!ctx.supplierId) return <UnlinkedNotice />;
  const wo = await db.workOrder.findFirst({ where: { id, supplierId: ctx.supplierId }, select: { supplierContractHtml: true, number: true } });
  if (!wo) notFound();
  const live = await renderContract("WO_SUPPLIER", id);
  return <ContractView title={live.title} html={wo.supplierContractHtml ?? live.html} frozen={!!wo.supplierContractHtml} backHref={`/marketplace/work-orders/${id}`} backLabel={`Πίσω (${wo.number})`} />;
}
