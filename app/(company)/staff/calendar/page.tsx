import { redirect } from "next/navigation";
import { getEffectivePermissions, can } from "@/lib/rbac/permissions";
import { listDemoRequests } from "@/lib/demo-booking";
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

  return (
    <DemoCalendarClient
      events={rows.map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        phone: r.phone,
        company: r.company,
        message: r.message,
        status: r.status,
        scheduledAt: r.scheduledAt.toISOString(),
        durationMin: r.durationMin,
      }))}
      today={new Date().toISOString()}
    />
  );
}
