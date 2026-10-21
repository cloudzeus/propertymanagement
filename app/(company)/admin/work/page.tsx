import { requirePermission } from "@/lib/rbac/permissions";
import { resolveWorkScope, loadWorkItems, countRecentSupportTickets, listAssignableEmployees } from "@/lib/work/queries";
import { viewerFor } from "@/lib/work/scope";
import { parseFilters } from "@/lib/work/kpis";
import { AutoRefresh } from "@/components/realtime/AutoRefresh";
import { WorkCenterClient } from "./WorkCenterClient";

export const metadata = { title: "Κέντρο εργασιών" };
export const dynamic = "force-dynamic";

/**
 * Κέντρο εργασιών — every pending company task in one list (faults, work
 * orders, RFQs, maintenance programme, appointments). Same URL for all four
 * company roles; the loader scopes a MANAGER to their customers and the
 * client defaults an EMPLOYEE to «Οι εργασίες μου».
 */
export default async function WorkCenterPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePermission("work", "view");
  const [scope, sp] = await Promise.all([resolveWorkScope(), searchParams]);
  const viewer = viewerFor(scope.role, scope.userId);
  const now = new Date();

  const [items, supportCount, employees] = await Promise.all([
    loadWorkItems(scope, now),
    countRecentSupportTickets(),
    viewer.canAssign ? listAssignableEmployees() : Promise.resolve([]),
  ]);

  const filters = parseFilters(sp);
  // «Οι εργασίες μου» is on by default for employees unless the URL says otherwise (mine=0).
  if (sp.mine === undefined) filters.mine = viewer.defaultMine;

  const buildings = [...new Map(items.map((i) => [i.buildingId, { id: i.buildingId, name: i.buildingName }])).values()]
    .sort((a, b) => a.name.localeCompare(b.name, "el"));

  return (
    <>
      <WorkCenterClient items={items} filters={filters} viewer={viewer} employees={employees} buildings={buildings} supportCount={supportCount} nowIso={now.toISOString()} />
      <AutoRefresh scope="company" />
    </>
  );
}
