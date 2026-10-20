import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireCollaborator } from "@/lib/marketplace";
import { UnlinkedNotice } from "@/components/marketplace/UnlinkedNotice";
import { renderContract } from "@/lib/contracts";
import { ContractView } from "@/components/contracts/ContractView";
import { AcceptContract } from "./AcceptContract";

export const metadata = { title: "Σύμβαση έργου" };

/** Supplier side (B) of the contract. */
export default async function SupplierContractPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireCollaborator("mkt-work-orders");
  if (!ctx.supplierId) return <UnlinkedNotice />;
  const wo = await db.workOrder.findFirst({ where: { id, supplierId: ctx.supplierId }, select: { supplierContractHtml: true, number: true, status: true, supplierAcceptedAt: true } });
  if (!wo) notFound();
  const live = await renderContract("WO_SUPPLIER", id);
  const canSign = wo.status === "ACCEPTED" && !wo.supplierAcceptedAt;
  return (
    <ContractView title={live.title} html={wo.supplierContractHtml ?? live.html} frozen={!!wo.supplierContractHtml} backHref={`/marketplace/work-orders/${id}`} backLabel={`Πίσω (${wo.number})`}>
      {canSign && <AcceptContract woId={id} woNumber={wo.number} isAdmin={ctx.isSupplierAdmin} defaultName={ctx.userName ?? ""} />}
    </ContractView>
  );
}
