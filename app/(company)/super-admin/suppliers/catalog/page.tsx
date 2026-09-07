import Link from "next/link";
import { db } from "@/lib/db";
import { requirePermission, getEffectivePermissions, can } from "@/lib/rbac/permissions";
import { listServiceCatalog } from "@/lib/suppliers";
import { CatalogAdminClient } from "./CatalogAdminClient";
import { RiArrowLeftLine } from "react-icons/ri";

export const metadata = { title: "Κατάλογος υπηρεσιών" };

export default async function ServiceCatalogPage() {
  await requirePermission("suppliers", "view");
  const resolved = await getEffectivePermissions();
  const [items, categories, usage] = await Promise.all([
    listServiceCatalog(false),
    db.maintenanceCategory.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    db.supplierService.groupBy({ by: ["catalogItemId"], where: { catalogItemId: { not: null }, active: true }, _count: { _all: true } }),
  ]);
  const usageMap = new Map(usage.map((u) => [u.catalogItemId!, u._count._all]));

  return (
    <div className="dash-page" style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 1000 }}>
      <Link href="/super-admin/suppliers" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "var(--fs-13)", color: "var(--muted-foreground)", textDecoration: "none" }}>
        <RiArrowLeftLine /> Πίσω στο μητρώο
      </Link>
      <CatalogAdminClient
        items={items.map((i) => ({ ...i, suppliers: usageMap.get(i.id) ?? 0 }))}
        categories={categories}
        canEdit={can(resolved!.perms, "suppliers", "edit")}
        canDelete={can(resolved!.perms, "suppliers", "delete")}
      />
    </div>
  );
}
