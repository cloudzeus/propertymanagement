import { db } from "@/lib/db";
import { auth } from "@/auth";
import Link from "next/link";
import { getPropertiesForMap } from "@/lib/dashboard/queries";
import { PropertiesMap } from "@/components/maps/PropertiesMap";
import { DashboardTabs } from "@/components/dashboard/DashboardTabs";
import { MaintenanceKanbanSection } from "@/components/maintenance/kanban-section";
import {
  RiToolsLine,
  RiFileListLine,
  RiArrowRightLine,
  RiCheckboxCircleLine,
  RiTimeLine,
  RiAlertLine,
} from "react-icons/ri";

async function getStaffStats(userId: string, companyId: string | undefined) {
  const propWhere = companyId ? { companyId } : {};
  const [myTasks, openMaintenance, inProgress] = await Promise.all([
    db.maintenanceRequest.count({ where: { building: propWhere, assignedToId: userId } }),
    db.maintenanceRequest.count({ where: { building: propWhere, status: "OPEN" } }),
    db.maintenanceRequest.count({ where: { building: propWhere, status: "IN_PROGRESS", assignedToId: userId } }),
  ]);
  return { myTasks, openMaintenance, inProgress };
}

async function getMyTasks(userId: string, companyId: string | undefined) {
  const propWhere = companyId ? { companyId } : {};
  return db.maintenanceRequest.findMany({
    where: { building: propWhere, assignedToId: userId, status: { in: ["OPEN", "IN_PROGRESS"] } },
    orderBy: { createdAt: "desc" },
    take: 8,
  });
}

const PRIORITY_COLOR: Record<string, string> = {
  URGENT: "var(--color-danger)",
  HIGH:   "var(--color-warning)",
  NORMAL: "var(--color-primary)",
  LOW:    "var(--muted-foreground)",
};

const STATUS_ICON: Record<string, React.ElementType> = {
  OPEN:        RiAlertLine,
  IN_PROGRESS: RiTimeLine,
  COMPLETED:   RiCheckboxCircleLine,
};

export default async function StaffDashboard() {
  const session = await auth();
  const userId = (session?.user as any)?.id ?? "";
  const companyId = (session?.user as any)?.companyId;
  const [stats, myTasks] = await Promise.all([
    getStaffStats(userId, companyId),
    getMyTasks(userId, companyId),
  ]);

  const { markers, missing } = await getPropertiesForMap();
  return (
    <DashboardTabs map={<PropertiesMap markers={markers} missing={missing} />}>
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--foreground)", margin: 0 }}>Οι Εργασίες μου</h1>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 4 }}>Επισκόπηση ανατεθειμένων εργασιών</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {[
          { label: "Οι Εργασίες μου", value: stats.myTasks, sub: "Ανατεθειμένες", icon: RiFileListLine, href: "/staff/tasks", color: "#0078D4" },
          { label: "Σε Εξέλιξη", value: stats.inProgress, sub: "Εκτελούνται τώρα", icon: RiTimeLine, href: "/staff/tasks", color: "#CA5D00" },
          { label: "Ανοιχτά (Εταιρεία)", value: stats.openMaintenance, sub: "Αναμένουν ανάθεση", icon: RiToolsLine, href: "/staff/maintenance", color: "#8764B8" },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.label} href={card.href} style={{
              background: "var(--card)", border: "1px solid var(--border)",
              borderRadius: "var(--radius)", padding: "20px 24px",
              display: "flex", flexDirection: "column", gap: 8, textDecoration: "none",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, color: "var(--muted-foreground)", fontWeight: 500 }}>{card.label}</span>
                <Icon style={{ fontSize: 20, color: card.color, opacity: 0.8 }} />
              </div>
              <span style={{ fontSize: 28, fontWeight: 700, color: "var(--foreground)", lineHeight: 1 }}>{card.value}</span>
              <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{card.sub}</span>
            </Link>
          );
        })}
      </div>

      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>Οι Εκκρεμείς Εργασίες μου</h2>
          <Link href="/staff/tasks" style={{ fontSize: 12, color: "var(--color-primary)", display: "flex", alignItems: "center", gap: 4, textDecoration: "none" }}>
            Όλες <RiArrowRightLine />
          </Link>
        </div>

        {myTasks.length === 0 ? (
          <div style={{ padding: "32px 0", textAlign: "center", color: "var(--muted-foreground)", fontSize: 13 }}>
            <RiCheckboxCircleLine style={{ fontSize: 32, opacity: 0.4, display: "block", margin: "0 auto 8px", color: "var(--color-success)" }} />
            Δεν υπάρχουν εκκρεμείς εργασίες
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {myTasks.map((task: any) => {
              const StatusIcon = STATUS_ICON[task.status] || RiAlertLine;
              return (
                <div key={task.id} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 14px", background: "var(--bg-canvas)", borderRadius: 6,
                }}>
                  <StatusIcon style={{ fontSize: 18, color: task.status === "IN_PROGRESS" ? "var(--color-primary)" : "var(--color-warning)", flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {task.title}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{task.status}</div>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, flexShrink: 0,
                    background: `${PRIORITY_COLOR[task.priority] || "var(--muted-foreground)"}18`,
                    color: PRIORITY_COLOR[task.priority] || "var(--muted-foreground)",
                  }}>
                    {task.priority}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
      <div style={{ marginTop: 24 }}>
        <MaintenanceKanbanSection />
      </div>
    </DashboardTabs>
  );
}
