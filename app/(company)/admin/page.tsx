import { auth } from "@/auth";
import { getPropertiesForMap } from "@/lib/dashboard/queries";
import { PropertiesMap } from "@/components/maps/PropertiesMap";
import { DashboardTabs } from "@/components/dashboard/DashboardTabs";
import { AdminHome } from "@/components/dashboard/homes/AdminHome";
import { MaintenanceKanbanSection } from "@/components/maintenance/kanban-section";
import { SupportTicketSection } from "@/components/support/support-ticket-section";

export default async function AdminDashboard() {
  const session = await auth();
  const companyId = (session?.user as any)?.companyId as string | undefined;
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const { markers, missing } = await getPropertiesForMap();

  return (
    <DashboardTabs map={<PropertiesMap markers={markers} missing={missing} />}>
      <AdminHome companyId={companyId} userId={userId} />
      <div style={{ marginTop: 16 }}>
        <MaintenanceKanbanSection />
      </div>
      <div style={{ marginTop: 16 }}>
        <SupportTicketSection />
      </div>
    </DashboardTabs>
  );
}
