import { getPropertiesForMap } from "@/lib/dashboard/queries";
import { PropertiesMap } from "@/components/maps/PropertiesMap";
import { DashboardTabs } from "@/components/dashboard/DashboardTabs";
import { SuperAdminHome } from "@/components/dashboard/homes/SuperAdminHome";
import { MaintenanceKanbanSection } from "@/components/maintenance/kanban-section";
import { SupportTicketSection } from "@/components/support/support-ticket-section";

export default async function SuperAdminDashboard() {
  const { markers, missing } = await getPropertiesForMap();
  return (
    <DashboardTabs map={<PropertiesMap markers={markers} missing={missing} />}>
      <SuperAdminHome />
      <div style={{ marginTop: 24 }}>
        <MaintenanceKanbanSection />
      </div>
      <div style={{ marginTop: 24 }}>
        <SupportTicketSection />
      </div>
    </DashboardTabs>
  );
}
