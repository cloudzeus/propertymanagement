import { db } from "@/lib/db";
import { requirePermission, getEffectivePermissions, can } from "@/lib/rbac/permissions";
import { companyRegistryWhere, ensurePlatformSupplier, supplierListInclude, supplierToDTO } from "@/lib/suppliers";
import { SuppliersClient } from "./SuppliersClient";
import { getDistanceZones } from "@/lib/distance/buildings";

export const metadata = { title: "Συνεργάτες & Προμηθευτές" };

export default async function SuppliersPage() {
  await requirePermission("suppliers", "view");
  const resolved = await getEffectivePermissions();
  const perms = resolved!.perms;
  await ensurePlatformSupplier();

  const [rows, categories, zones] = await Promise.all([
    // Company registry only — customers' private lists are never listed here.
    db.supplier.findMany({
      where: { ...companyRegistryWhere, isPlatform: false },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      include: supplierListInclude,
    }),
    db.maintenanceCategory.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    getDistanceZones(),
  ]);

  return (
    <SuppliersClient
      suppliers={rows.map(supplierToDTO)}
      categories={categories}
      zones={zones}
      caps={{ create: can(perms, "suppliers", "create"), edit: can(perms, "suppliers", "edit"), delete: can(perms, "suppliers", "delete") }}
    />
  );
}
