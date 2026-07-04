import { db } from "@/lib/db";
import { auth } from "@/auth";
import Link from "next/link";
import { getPropertiesForMap } from "@/lib/dashboard/queries";
import { PropertiesMap } from "@/components/maps/PropertiesMap";
import { DashboardTabs } from "@/components/dashboard/DashboardTabs";
import {
  RiBuildingLine,
  RiHome3Line,
  RiToolsLine,
  RiNotification2Line,
  RiArrowRightLine,
  RiCheckboxCircleLine,
  RiTimeLine,
} from "react-icons/ri";

async function getManagerStats(companyId: string | undefined) {
  const propWhere = companyId ? { companyId } : {};
  const [totalProperties, totalUnits, openMaintenance, inProgressMaintenance, activeAnnouncements] = await Promise.all([
    db.building.count({ where: propWhere }),
    db.unit.count({ where: companyId ? { building: { companyId } } : {} }),
    db.maintenanceRequest.count({ where: { building: propWhere, status: "OPEN" } }),
    db.maintenanceRequest.count({ where: { building: propWhere, status: "IN_PROGRESS" } }),
    db.announcement.count({ where: { building: propWhere, status: "ACTIVE" } }),
  ]);
  return { totalProperties, totalUnits, openMaintenance, inProgressMaintenance, activeAnnouncements };
}

async function getRecentMaintenance(companyId: string | undefined) {
  const propWhere = companyId ? { companyId } : {};
  return db.maintenanceRequest.findMany({
    where: { building: propWhere, status: { in: ["OPEN", "IN_PROGRESS"] } },
    orderBy: { createdAt: "desc" },
    take: 6,
  });
}

const PRIORITY_COLOR: Record<string, string> = {
  URGENT: "var(--color-danger)",
  HIGH:   "var(--color-warning)",
  NORMAL: "var(--color-primary)",
  LOW:    "var(--muted-foreground)",
};

export default async function ManagerDashboard() {
  const session = await auth();
  const companyId = (session?.user as any)?.companyId;
  const [stats, recentMaintenance] = await Promise.all([
    getManagerStats(companyId),
    getRecentMaintenance(companyId),
  ]);

  const { markers, missing } = await getPropertiesForMap();
  return (
    <DashboardTabs map={<PropertiesMap markers={markers} missing={missing} />}>
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--foreground)", margin: 0 }}>Διαχείριση Ακινήτων</h1>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 4 }}>Επισκόπηση και εκκρεμότητες</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        {[
          { label: "Ακίνητα", value: stats.totalProperties, sub: "Υπό διαχείριση", icon: RiBuildingLine, href: "/manager/properties", color: "#8764B8" },
          { label: "Μονάδες", value: stats.totalUnits, sub: "Σύνολο", icon: RiHome3Line, href: "/manager/units", color: "#038387" },
          { label: "Ανοιχτά Αιτήματα", value: stats.openMaintenance, sub: "Αναμένουν ανάθεση", icon: RiCheckboxCircleLine, href: "/manager/maintenance", color: "#CA5D00" },
          { label: "Σε Εξέλιξη", value: stats.inProgressMaintenance, sub: "Εργασίες σε εξέλιξη", icon: RiTimeLine, href: "/manager/maintenance", color: "#0078D4" },
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

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        {/* Recent maintenance */}
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>Εκκρεμή Αιτήματα Συντήρησης</h2>
            <Link href="/manager/maintenance" style={{ fontSize: 12, color: "var(--color-primary)", display: "flex", alignItems: "center", gap: 4, textDecoration: "none" }}>
              Όλα <RiArrowRightLine />
            </Link>
          </div>

          {recentMaintenance.length === 0 ? (
            <div style={{ padding: "32px 0", textAlign: "center", color: "var(--muted-foreground)", fontSize: 13 }}>
              <RiToolsLine style={{ fontSize: 32, opacity: 0.4, marginBottom: 8, display: "block", margin: "0 auto 8px" }} />
              Δεν υπάρχουν εκκρεμή αιτήματα
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {recentMaintenance.map((req: any) => (
                <div key={req.id} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 12px", background: "var(--bg-canvas)", borderRadius: 6,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {req.title}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{req.status}</div>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, flexShrink: 0, marginLeft: 12,
                    background: `${PRIORITY_COLOR[req.priority] || "var(--muted-foreground)"}18`,
                    color: PRIORITY_COLOR[req.priority] || "var(--muted-foreground)",
                  }}>
                    {req.priority}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Announcements + links */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 20 }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)", margin: "0 0 12px" }}>Ανακοινώσεις</h2>
            <div style={{ fontSize: 32, fontWeight: 700, color: "var(--color-primary)" }}>{stats.activeAnnouncements}</div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 4 }}>Ενεργές</div>
            <Link href="/manager/announcements" style={{
              display: "flex", alignItems: "center", gap: 4, marginTop: 12,
              fontSize: 12, color: "var(--color-primary)", textDecoration: "none",
            }}>
              Διαχείριση <RiArrowRightLine />
            </Link>
          </div>
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 20 }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)", margin: "0 0 12px" }}>Γρήγορες Ενέργειες</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { label: "Νέα Ανακοίνωση", href: "/manager/announcements", icon: RiNotification2Line },
                { label: "Νέο Αίτημα", href: "/manager/maintenance", icon: RiToolsLine },
              ].map((link) => {
                const Icon = link.icon;
                return (
                  <Link key={link.href} href={link.href} style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
                    borderRadius: 6, background: "var(--bg-canvas)", textDecoration: "none",
                    color: "var(--foreground)", fontSize: 13,
                  }}>
                    <Icon style={{ color: "var(--color-primary)", fontSize: 15 }} />
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
    </DashboardTabs>
  );
}
