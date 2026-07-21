"use server";

import { requirePermission } from "@/lib/rbac/permissions";
import { getBuildingDrilldown, type BuildingDrilldown } from "@/lib/dashboard/managed-buildings";

export async function fetchBuildingDrilldown(buildingId: string): Promise<BuildingDrilldown> {
  await requirePermission("managed-buildings", "view");
  return getBuildingDrilldown(buildingId);
}
