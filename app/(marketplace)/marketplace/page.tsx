import { requireCollaborator } from "@/lib/marketplace";
import { UnlinkedNotice } from "@/components/marketplace/UnlinkedNotice";
import { CollaboratorHome } from "@/components/dashboard/homes/CollaboratorHome";

export const metadata = { title: "Συνεργάτης — Dashboard" };

export default async function MarketplaceHome() {
  const ctx = await requireCollaborator("mkt-dashboard");
  if (!ctx.supplierId) return <UnlinkedNotice />;
  return (
    <div className="dash-page">
      <CollaboratorHome supplierId={ctx.supplierId} supplierName={ctx.supplierName} isSupplierAdmin={ctx.isSupplierAdmin} />
    </div>
  );
}
