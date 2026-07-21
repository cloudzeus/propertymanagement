import { requirePermission } from "@/lib/rbac/permissions";
import { listManagedBuildings, listUpcomingObligations, listRecentMaintenance } from "@/lib/dashboard/managed-buildings";
import { ManagedBuildingsClient } from "./ManagedBuildingsClient";

export const metadata = { title: "Διαχειριζόμενα κτήρια" };
export const dynamic = "force-dynamic";

export default async function ManagedBuildingsPage() {
  await requirePermission("managed-buildings", "view");
  const [buildings, obligations, recent] = await Promise.all([
    listManagedBuildings(),
    listUpcomingObligations(),
    listRecentMaintenance(),
  ]);
  return <ManagedBuildingsClient buildings={buildings} obligations={obligations} recent={recent} />;
}
