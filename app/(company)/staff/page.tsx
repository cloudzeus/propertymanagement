import { auth } from "@/auth";
import { getPropertiesForMap } from "@/lib/dashboard/queries";
import { PropertiesMap } from "@/components/maps/PropertiesMap";
import { DashboardTabs } from "@/components/dashboard/DashboardTabs";
import { StaffHome } from "@/components/dashboard/homes/StaffHome";
import { MaintenanceKanbanSection } from "@/components/maintenance/kanban-section";
import { SupportTicketSection } from "@/components/support/support-ticket-section";

export default async function StaffDashboard() {
  const session = await auth();
  const userId = (session?.user as any)?.id ?? "";
  const companyId = (session?.user as any)?.companyId as string | undefined;
  const { markers, missing } = await getPropertiesForMap();

  return (
    <DashboardTabs map={<PropertiesMap markers={markers} missing={missing} />}>
      <StaffHome userId={userId} companyId={companyId} />
      <div style={{ marginTop: 24 }}>
        <MaintenanceKanbanSection />
      </div>
      <div style={{ marginTop: 24 }}>
        <SupportTicketSection />
      </div>
    </DashboardTabs>
  );
}
