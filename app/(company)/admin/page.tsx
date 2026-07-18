import { db } from "@/lib/db";
import { auth } from "@/auth";
import Link from "next/link";
import { getPropertiesForMap } from "@/lib/dashboard/queries";
import { PropertiesMap } from "@/components/maps/PropertiesMap";
import { DashboardTabs } from "@/components/dashboard/DashboardTabs";
import { MaintenanceKanbanSection } from "@/components/maintenance/kanban-section";
import { SupportTicketSection } from "@/components/support/support-ticket-section";
import {
  RiBuildingLine,
  RiHome3Line,
  RiGroupLine,
  RiToolsLine,
  RiArrowRightLine,
  RiUserLine,
  RiNotification2Line,
  RiCalendarLine,
} from "react-icons/ri";

async function getAdminStats(companyId: string | undefined) {
  const propWhere = companyId ? { companyId } : {};
  const [totalProperties, totalUnits, totalUsers, openMaintenance, announcements] = await Promise.all([
    db.building.count({ where: propWhere }),
    db.unit.count({ where: companyId ? { building: { companyId } } : {} }),
    db.user.count({ where: companyId ? { companyId } : {} }),
    db.maintenanceRequest.count({ where: { building: propWhere, status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    db.announcement.count({ where: { building: propWhere, status: "ACTIVE" } }),
  ]);
  return { totalProperties, totalUnits, totalUsers, openMaintenance, announcements };
}

export default async function AdminDashboard() {
  const session = await auth();
  const companyId = (session?.user as any)?.companyId;
  const stats = await getAdminStats(companyId);

  const statCards = [
    { label: "Ακίνητα", value: stats.totalProperties, sub: "Κτίρια υπό διαχείριση", icon: RiBuildingLine, href: "/admin/properties", color: "#8764B8" },
    { label: "Μονάδες", value: stats.totalUnits, sub: "Σύνολο μονάδων", icon: RiHome3Line, href: "/admin/units", color: "#038387" },
    { label: "Χρήστες", value: stats.totalUsers, sub: "Ενεργά μέλη", icon: RiGroupLine, href: "/admin/users", color: "#0078D4" },
    { label: "Ανοιχτές Αιτήσεις", value: stats.openMaintenance, sub: "Εκκρεμείς εργασίες", icon: RiToolsLine, href: "/admin/maintenance", color: "#CA5D00" },
  ];

  const quickLinks = [
    { label: "Ενοικιαστές", href: "/admin/residents", icon: RiUserLine, color: "#8764B8" },
    { label: "Ανακοινώσεις", href: "/admin/announcements", icon: RiNotification2Line, color: "#0078D4" },
    { label: "Ημερολόγιο", href: "/admin/calendar", icon: RiCalendarLine, color: "#107C10" },
    { label: "Αναφορές", href: "/admin/reports", icon: RiBuildingLine, color: "#CA5D00" },
  ];

  const { markers, missing } = await getPropertiesForMap();
  return (
    <DashboardTabs map={<PropertiesMap markers={markers} missing={missing} />}>
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--foreground)", margin: 0 }}>Πίνακας Διαχείρισης</h1>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 4 }}>Επισκόπηση εταιρείας και γρήγορες ενέργειες</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        {statCards.map((card) => {
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

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Quick Links */}
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)", margin: "0 0 16px" }}>Γρήγορες Ενέργειες</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {quickLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link key={link.href} href={link.href} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "12px 14px", borderRadius: 8,
                  background: "var(--bg-canvas)", border: "1px solid var(--border)",
                  textDecoration: "none", color: "var(--foreground)",
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                    background: `${link.color}18`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Icon style={{ fontSize: 16, color: link.color }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{link.label}</span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* System info */}
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>Σύνοψη</h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Ενεργές Ανακοινώσεις</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>{stats.announcements}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Εκκρεμείς Αιτήσεις</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: stats.openMaintenance > 0 ? "var(--color-warning)" : "var(--foreground)" }}>
                {stats.openMaintenance}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}>
              <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Σύνολο Μονάδων</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>{stats.totalUnits}</span>
            </div>
          </div>
          <Link href="/admin/reports" style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            marginTop: 16, padding: "8px 0",
            fontSize: 13, color: "var(--color-primary)", textDecoration: "none",
            borderTop: "1px solid var(--border)",
          }}>
            Προβολή Αναφορών <RiArrowRightLine />
          </Link>
        </div>
      </div>
    </div>
      <div style={{ marginTop: 24 }}>
        <MaintenanceKanbanSection />
      </div>
      <div style={{ marginTop: 24 }}>
        <SupportTicketSection />
      </div>
    </DashboardTabs>
  );
}
