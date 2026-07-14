import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/rbac/permissions";
import { getEffectiveSession } from "@/lib/auth-effective";
import { db } from "@/lib/db";
import { MaintenanceSettingsClient } from "./MaintenanceSettingsClient";

export const metadata = { title: "Ρυθμίσεις βλαβών" };

export default async function MaintenanceSettingsPage() {
  await requirePermission("maintenance", "edit");
  const eff = await getEffectiveSession();
  if (!["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(eff!.user.role as string)) redirect("/admin/maintenance");

  const [categories, rules, properties] = await Promise.all([
    db.maintenanceCategory.findMany({ orderBy: { sortOrder: "asc" } }),
    db.maintenanceCoverageRule.findMany({
      orderBy: { createdAt: "desc" },
      include: { property: { select: { name: true } }, category: { select: { name: true } } },
    }),
    db.property.findMany({ where: { managed: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <MaintenanceSettingsClient
      categories={categories.map((c) => ({
        id: c.id, name: c.name, icon: c.icon, active: c.active, sortOrder: c.sortOrder,
        slaHours: c.slaHours, companyResponsible: c.companyResponsible,
      }))}
      rules={rules.map((r) => ({
        id: r.id, propertyId: r.propertyId, propertyName: r.property?.name ?? null,
        categoryId: r.categoryId, categoryName: r.category?.name ?? null,
        elementLabel: r.elementLabel, covered: r.covered,
        quantityLimit: r.quantityLimit, periodMonths: r.periodMonths, notes: r.notes,
      }))}
      properties={properties}
    />
  );
}
