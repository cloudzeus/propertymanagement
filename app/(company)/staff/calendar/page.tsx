import { redirect } from "next/navigation";
import { getEffectivePermissions, can } from "@/lib/rbac/permissions";
import { listDemoRequests } from "@/lib/demo-booking";
import { listMaintenanceCalendar } from "@/lib/dashboard/maintenance-calendar";
import { DemoCalendarClient } from "./DemoCalendarClient";

export const dynamic = "force-dynamic";

export default async function StaffCalendarPage() {
  const resolved = await getEffectivePermissions();
  if (!resolved) redirect("/login");
  // Company roles see it via "calendar", employees via the marketplace "mkt-calendar".
  if (!can(resolved.perms, "calendar", "view") && !can(resolved.perms, "mkt-calendar", "view")) {
    redirect("/unauthorized");
  }

  // Load a generous window; the client renders one month at a time.
  const from = new Date();
  from.setMonth(from.getMonth() - 1);
  const to = new Date();
  to.setMonth(to.getMonth() + 3);
  const rows = await listDemoRequests(from, to);
  const maint = await listMaintenanceCalendar(from, to);

  return (
    <DemoCalendarClient
      events={[
        ...rows.map((r) => ({
          id: r.id, kind: "demo" as const, name: r.name, email: r.email, phone: r.phone,
          company: r.company, message: r.message, status: r.status,
          scheduledAt: r.scheduledAt.toISOString(), durationMin: r.durationMin,
          buildingId: null as string | null, buildingName: null as string | null, overdue: false, itemName: null as string | null,
        })),
        ...maint.map((m) => ({
          id: m.id, kind: "maintenance" as const, name: m.title, email: "", phone: null,
          company: m.buildingName, message: m.itemName, status: m.overdue ? "OVERDUE" : "SCHEDULED",
          scheduledAt: m.date, durationMin: 0,
          buildingId: m.buildingId, buildingName: m.buildingName, overdue: m.overdue, itemName: m.itemName,
        })),
      ]}
      today={new Date().toISOString()}
    />
  );
}
