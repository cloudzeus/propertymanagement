import { db } from "@/lib/db";
import { requirePermission } from "@/lib/rbac/permissions";
import {
  RiBuildingLine,
  RiGroupLine,
  RiHome3Line,
  RiToolsLine,
  RiBarChartLine,
} from "react-icons/ri";

export const metadata = { title: "Αναφορές — Super Admin" };

async function getReportData() {
  const [totalCompanies, totalUsers, totalProperties, totalUnits, openMaintenance] = await Promise.all([
    db.company.count(),
    db.user.count(),
    db.building.count(),
    db.unit.count(),
    db.maintenanceRequest.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } as any }),
  ]);

  const usersByRole = await (db as any).user.groupBy({
    by: ["role"],
    _count: { role: true },
  });

  const companiesByStatus = await (db as any).company.groupBy({
    by: ["status"],
    _count: { status: true },
  });

  return { totalCompanies, totalUsers, totalProperties, totalUnits, openMaintenance, usersByRole, companiesByStatus };
}

const ROLE_COLOR: Record<string, string> = {
  SUPER_ADMIN:       "#A4262C",
  ADMIN:             "#0078D4",
  MANAGER:           "#8764B8",
  PROPERTY_ADMIN:    "#038387",
  EMPLOYEE:          "#CA5D00",
  COLLABORATOR:      "#107C10",
  PROPERTY_OWNER:    "#8764B8",
  PROPERTY_RESIDENT: "#0078D4",
  PROPERTY_VIEWER:   "#707070",
};

const STATUS_COLOR: Record<string, string> = {
  ACTIVE:    "#107C10",
  TRIAL:     "#0078D4",
  SUSPENDED: "#CA5D00",
  INACTIVE:  "#707070",
};

export default async function ReportsPage() {
  await requirePermission("reports", "view");
  const data = await getReportData();

  const topStats = [
    { label: "Εταιρείες", value: data.totalCompanies, icon: RiBuildingLine, color: "#8764B8" },
    { label: "Χρήστες", value: data.totalUsers, icon: RiGroupLine, color: "#0078D4" },
    { label: "Ακίνητα", value: data.totalProperties, icon: RiHome3Line, color: "#038387" },
    { label: "Μονάδες", value: data.totalUnits, icon: RiHome3Line, color: "#107C10" },
    { label: "Εκκρεμείς Εργασίες", value: data.openMaintenance, icon: RiToolsLine, color: "#CA5D00" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <RiBarChartLine style={{ fontSize: 24, color: "var(--color-primary)" }} />
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--foreground)", margin: 0 }}>Αναφορές Συστήματος</h1>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 4 }}>Στατιστικά στοιχεία για όλες τις εταιρείες</p>
        </div>
      </div>

      {/* Top stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14 }}>
        {topStats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} style={{
              background: "var(--card)", border: "1px solid var(--border)",
              borderRadius: "var(--radius)", padding: "18px 20px",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: "var(--muted-foreground)", fontWeight: 500 }}>{stat.label}</span>
                <Icon style={{ fontSize: 18, color: stat.color, opacity: 0.7 }} />
              </div>
              <span style={{ fontSize: 26, fontWeight: 700, color: "var(--foreground)" }}>{stat.value}</span>
            </div>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Users by role */}
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)", margin: "0 0 16px" }}>Χρήστες ανά Ρόλο</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(data.usersByRole as any[]).map((row) => {
              const color = ROLE_COLOR[row.role] || "#707070";
              const pct = data.totalUsers > 0 ? Math.round((row._count.role / data.totalUsers) * 100) : 0;
              return (
                <div key={row.role}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 13, color: "var(--foreground)", fontWeight: 500 }}>{row.role}</span>
                    <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>{row._count.role} ({pct}%)</span>
                  </div>
                  <div style={{ height: 6, background: "var(--bg-canvas)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3, transition: "width 0.3s" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Companies by status */}
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)", margin: "0 0 16px" }}>Εταιρείες ανά Κατάσταση</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {(data.companiesByStatus as any[]).map((row) => {
              const color = STATUS_COLOR[row.status] || "#707070";
              const pct = data.totalCompanies > 0 ? Math.round((row._count.status / data.totalCompanies) * 100) : 0;
              return (
                <div key={row.status} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 14px", background: "var(--bg-canvas)", borderRadius: 6,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: "var(--foreground)", fontWeight: 500 }}>{row.status}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 18, fontWeight: 700, color: "var(--foreground)" }}>{row._count.status}</span>
                    <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{pct}%</span>
                  </div>
                </div>
              );
            })}
            {data.companiesByStatus.length === 0 && (
              <div style={{ padding: "24px 0", textAlign: "center", color: "var(--muted-foreground)", fontSize: 13 }}>
                Δεν υπάρχουν δεδομένα
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
