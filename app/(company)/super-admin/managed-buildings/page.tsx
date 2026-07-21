import { requirePermission } from "@/lib/rbac/permissions";
import { listManagedBuildings, listUpcomingObligations, listRecentMaintenance } from "@/lib/dashboard/managed-buildings";
import { db } from "@/lib/db";
import { ManagedBuildingsClient } from "./ManagedBuildingsClient";

export const metadata = { title: "Διαχειριζόμενα κτήρια" };
export const dynamic = "force-dynamic";

export default async function ManagedBuildingsPage() {
  await requirePermission("managed-buildings", "view");
  const [buildings, obligations, recent, itemTypes] = await Promise.all([
    listManagedBuildings(),
    listUpcomingObligations(),
    listRecentMaintenance(),
    db.managedItemType.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return <ManagedBuildingsClient buildings={buildings} obligations={obligations} recent={recent} itemTypes={itemTypes} />;
}
