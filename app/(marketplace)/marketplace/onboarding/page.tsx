import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireCollaborator } from "@/lib/marketplace";
import { UnlinkedNotice } from "@/components/marketplace/UnlinkedNotice";
import { loadSupplierFull, listServiceCatalog } from "@/lib/suppliers";
import { OnboardingWizard } from "./OnboardingWizard";

export const metadata = { title: "Καλώς ήρθατε — Ρύθμιση συνεργάτη" };

export default async function OnboardingPage() {
  const ctx = await requireCollaborator("mkt-profile", "edit", { allowUnonboarded: true });
  if (!ctx.supplierId) return <UnlinkedNotice />;
  // Only the supplier's admin runs the wizard; technicians go to the dashboard.
  if (!ctx.isSupplierAdmin) redirect("/marketplace");
  const [full, catalog, categories] = await Promise.all([
    loadSupplierFull(ctx.supplierId),
    listServiceCatalog(),
    db.maintenanceCategory.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!full) notFound();

  return (
    <OnboardingWizard
      supplier={full.supplier}
      catalog={catalog}
      categories={categories}
      existing={full.services.filter((s) => s.catalogItemId).map((s) => ({ catalogItemId: s.catalogItemId!, price: s.price, unit: s.unit, active: s.active }))}
      userName={ctx.userName}
    />
  );
}
