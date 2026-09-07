import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCollaborator } from "@/lib/marketplace";
import { UnlinkedNotice } from "@/components/marketplace/UnlinkedNotice";
import { listSupplierWorkOrders } from "@/lib/rfq";
import { WorkOrderActions } from "./WorkOrderActions";
import { RiArrowLeftLine } from "react-icons/ri";

export const metadata = { title: "Σύμβαση έργου" };

export default async function SupplierWorkOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireCollaborator("mkt-work-orders");
  if (!ctx.supplierId) return <UnlinkedNotice />;
  const wo = (await listSupplierWorkOrders(ctx.supplierId)).find((w) => w.id === id);
  if (!wo) notFound();
  return (
    <div className="dash-page" style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 860 }}>
      <Link href="/marketplace/work-orders" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "var(--fs-13)", color: "var(--muted-foreground)", textDecoration: "none" }}><RiArrowLeftLine /> Πίσω στις συμβάσεις</Link>
      <WorkOrderActions wo={wo} isAdmin={ctx.isSupplierAdmin} />
    </div>
  );
}
