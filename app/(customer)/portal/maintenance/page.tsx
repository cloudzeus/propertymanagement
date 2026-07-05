import { auth } from "@/auth";
import { db } from "@/lib/db";
import { listMaintenanceHistory } from "@/app/actions/maintenance-logs";
import { CalendarPanel } from "@/app/(company)/super-admin/buildings/[id]/CalendarPanel";
import { MaintenanceTab } from "@/app/(company)/super-admin/buildings/[id]/MaintenanceTab";
import { EmptyState } from "@/components/dashboard";
import { RiToolsLine } from "react-icons/ri";

export default async function PortalMaintenance() {
  const session = await auth();
  const userId = (session?.user as any)?.id ?? "";

  const assignments = await db.managementAssignment.findMany({
    where: { userId, role: "PROPERTY_ADMIN" },
    select: { buildingId: true, propertyId: true },
  });

  const directIds = assignments.map((a) => a.buildingId).filter((x): x is string => !!x);
  const propertyIds = assignments.map((a) => a.propertyId).filter((x): x is string => !!x);
  const propertyBuildings = propertyIds.length
    ? await db.building.findMany({ where: { propertyId: { in: propertyIds } }, select: { id: true } })
    : [];
  const buildingIds = Array.from(new Set([...directIds, ...propertyBuildings.map((b) => b.id)]));

  if (buildingIds.length === 0) {
    return (
      <div className="dash-page" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--foreground)" }}>Συντηρήσεις</h1>
        <EmptyState icon={RiToolsLine} label="Δεν διαχειρίζεστε κτήρια." />
      </div>
    );
  }

  const buildings = await db.building.findMany({
    where: { id: { in: buildingIds } },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      recurringTasks: {
        orderBy: { nextDueDate: "asc" },
        select: {
          id: true, title: true, frequency: true, nextDueDate: true, vendor: true,
          notes: true, active: true, kind: true, inServicePackage: true, reminderDaysBefore: true,
        },
      },
    },
  });

  const today = new Date().toISOString();

  const sections = await Promise.all(
    buildings.map(async (b) => ({
      id: b.id,
      name: b.name,
      tasks: b.recurringTasks.map((t) => ({ ...t, nextDueDate: t.nextDueDate ? t.nextDueDate.toISOString() : null })),
      history: await listMaintenanceHistory(b.id),
    })),
  );

  return (
    <div className="dash-page" style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--foreground)" }}>Συντηρήσεις</h1>

      {sections.map((s) => (
        <div key={s.id} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--foreground)" }}>{s.name}</h2>
          <CalendarPanel buildingId={s.id} tasks={s.tasks} today={today} />
          <MaintenanceTab rows={s.history} tasks={s.tasks} buildingId={s.id} />
        </div>
      ))}
    </div>
  );
}
