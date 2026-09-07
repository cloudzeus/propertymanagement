import { notFound } from "next/navigation";
import { can } from "@/lib/rbac/permissions";
import { requireCollaborator } from "@/lib/marketplace";
import { UnlinkedNotice } from "@/components/marketplace/UnlinkedNotice";
import { loadSupplierFull } from "@/lib/suppliers";
import { CatalogEditor } from "@/components/suppliers/CatalogEditor";
import { RiPriceTag3Line } from "react-icons/ri";

export const metadata = { title: "Υπηρεσίες & προϊόντα" };

export default async function SupplierCatalogPage() {
  const ctx = await requireCollaborator("mkt-catalog");
  if (!ctx.supplierId) return <UnlinkedNotice />;
  const full = await loadSupplierFull(ctx.supplierId);
  if (!full) notFound();
  const canEdit = ctx.isSupplierAdmin && can(ctx.perms, "mkt-catalog", "edit");

  return (
    <div className="dash-page" style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 1100 }}>
      <div>
        <h1 style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 22, fontWeight: 700, color: "var(--foreground)", margin: 0 }}><RiPriceTag3Line style={{ color: "var(--color-primary)" }} /> Υπηρεσίες & προϊόντα</h1>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted-foreground)" }}>
          Ο κατάλογός σας με καθαρές τιμές. Χρησιμοποιείται ως βάση όταν σας ζητηθεί προσφορά από την εταιρεία διαχείρισης.
        </p>
      </div>
      <CatalogEditor supplierId={full.supplier.id} kind={full.supplier.kind} services={full.services} products={full.products} canEdit={canEdit} />
    </div>
  );
}
