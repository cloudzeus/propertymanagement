import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/permissions";
import { requireCollaborator } from "@/lib/marketplace";
import { UnlinkedNotice } from "@/components/marketplace/UnlinkedNotice";
import { loadSupplierFull } from "@/lib/suppliers";
import { SupplierHeader } from "@/components/suppliers/SupplierHeader";
import { RiInformationLine } from "react-icons/ri";

export const metadata = { title: "Προφίλ & ωράρια" };

export default async function SupplierProfilePage() {
  const ctx = await requireCollaborator("mkt-profile");
  if (!ctx.supplierId) return <UnlinkedNotice />;
  const [full, categories] = await Promise.all([
    loadSupplierFull(ctx.supplierId),
    db.maintenanceCategory.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!full) notFound();
  const canEdit = ctx.isSupplierAdmin && can(ctx.perms, "mkt-profile", "edit");

  return (
    <div className="dash-page" style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 1000 }}>
      <SupplierHeader supplier={full.supplier} categories={categories} canEdit={canEdit} />
      {!ctx.isSupplierAdmin && (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12.5, color: "var(--muted-foreground)", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px" }}>
          <RiInformationLine style={{ marginTop: 2, flexShrink: 0 }} /> Μόνο ο διαχειριστής της επιχείρησής σας μπορεί να επεξεργαστεί το προφίλ, το ωράριο και τις ειδικότητες.
        </div>
      )}
    </div>
  );
}
