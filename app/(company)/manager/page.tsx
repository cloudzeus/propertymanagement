import { auth } from "@/auth";
import { getPropertiesForMap } from "@/lib/dashboard/queries";
import { PropertiesMap } from "@/components/maps/PropertiesMap";
import { DashboardTabs } from "@/components/dashboard/DashboardTabs";
import { ManagerHome } from "@/components/dashboard/homes/ManagerHome";
import { MaintenanceKanbanSection } from "@/components/maintenance/kanban-section";
import { SupportTicketSection } from "@/components/support/support-ticket-section";

export default async function ManagerDashboard() {
  const session = await auth();
  const companyId = (session?.user as any)?.companyId as string | undefined;
  const { markers, missing } = await getPropertiesForMap();

  return (
    <DashboardTabs map={<PropertiesMap markers={markers} missing={missing} />}>
      <ManagerHome companyId={companyId} />
      <div style={{ marginTop: 24 }}>
        <MaintenanceKanbanSection />
      </div>
      <div style={{ marginTop: 24 }}>
        <SupportTicketSection />
      </div>
    </DashboardTabs>
  );
}
