import { auth } from "@/auth";
import { db } from "@/lib/db";
import { listMaintenanceHistory } from "@/app/actions/maintenance-logs";
import { CalendarPanel } from "@/app/(company)/super-admin/buildings/[id]/CalendarPanel";
import { MaintenanceTab } from "@/app/(company)/super-admin/buildings/[id]/MaintenanceTab";
import { EmptyState } from "@/components/dashboard";
import { RiToolsLine } from "react-icons/ri";
import Link from "next/link";
import { NewRequestButton } from "@/components/maintenance/new-request-form";
import { STATUS_LABELS, STATUS_COLORS, HANDLER_LABELS, type FaultStatus } from "@/lib/maintenance-shared";

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

  // Βλάβες των κτηρίων που διαχειρίζεται + δεδομένα για τη φόρμα δήλωσης
  const [faults, categories, formBuildings] = await Promise.all([
    db.maintenanceRequest.findMany({
      where: { buildingId: { in: buildingIds } },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { building: { select: { name: true } }, categoryRef: { select: { name: true } } },
    }),
    db.maintenanceCategory.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    db.building.findMany({
      where: { id: { in: buildingIds } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, units: { orderBy: { unitNumber: "asc" }, select: { id: true, unitNumber: true } } },
    }),
  ]);

  return (
    <div className="dash-page" style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--foreground)", margin: 0, flex: 1 }}>Συντηρήσεις</h1>
        <NewRequestButton
          buildings={formBuildings.map((b) => ({ id: b.id, name: b.name, units: b.units.map((u) => ({ id: u.id, label: `Μονάδα ${u.unitNumber}` })) }))}
          categories={categories}
          detailBase="/portal/maintenance"
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>Βλάβες</h2>
        {faults.length === 0 ? (
          <EmptyState icon={RiToolsLine} label="Δεν υπάρχουν δηλωμένες βλάβες." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {faults.map((r) => {
              const color = STATUS_COLORS[r.status as FaultStatus] ?? "#6b7280";
              return (
                <Link key={r.id} href={`/portal/maintenance/${r.id}`} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", textDecoration: "none",
                  background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>{r.title}</div>
                    <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                      {r.building.name} · {r.categoryRef?.name ?? r.category} · {r.createdAt.toLocaleString("el-GR", { dateStyle: "short", timeStyle: "short" })}
                      {" · Υπεύθυνος: "}{HANDLER_LABELS[r.handledBy] ?? r.handledBy}
                    </div>
                  </div>
                  <span style={{ padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, color, background: `${color}18`, border: `1px solid ${color}40`, whiteSpace: "nowrap" }}>
                    {STATUS_LABELS[r.status as FaultStatus] ?? r.status}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>

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
