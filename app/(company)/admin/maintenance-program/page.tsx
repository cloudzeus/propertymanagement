import { requirePermission, getEffectivePermissions, can } from "@/lib/rbac/permissions";
import { loadMaintenanceProgramme } from "@/lib/dashboard/maintenance-program";
import { ProgrammeClient } from "./ProgrammeClient";

export const metadata = { title: "Ετήσιο πρόγραμμα συντηρήσεων" };

type SP = { year?: string; building?: string };

/** Company: all recurring maintenance projected over a year, with supplier continuity and one-click fault opening. */
export default async function MaintenanceProgrammePage({ searchParams }: { searchParams: Promise<SP> }) {
  await requirePermission("maintenance-program", "view");
  const resolved = await getEffectivePermissions();
  const sp = await searchParams;
  const year = Number(sp.year) || new Date().getFullYear();
  const buildingId = sp.building || null;
  const data = await loadMaintenanceProgramme(year, buildingId);
  return (
    <ProgrammeClient
      year={year}
      buildingId={buildingId}
      rows={data.rows}
      buildings={data.buildings}
      caps={{ edit: can(resolved?.perms ?? new Set<string>(), "maintenance-program", "edit"), create: can(resolved?.perms ?? new Set<string>(), "maintenance-program", "create") }}
    />
  );
}
