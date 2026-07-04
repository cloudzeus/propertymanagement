import { db } from "@/lib/db";
import Link from "next/link";
import { roleLabel, roleColor } from "@/lib/roles-constants";
import { getPropertiesForMap } from "@/lib/dashboard/queries";
import { PropertiesMap } from "@/components/maps/PropertiesMap";
import { DashboardTabs } from "@/components/dashboard/DashboardTabs";
import {
  RiBuildingLine,
  RiGroupLine,
  RiHome3Line,
  RiMoneyEuroCircleLine,
  RiArrowRightLine,
  RiCheckboxCircleFill,
  RiBuilding2Line,
  RiUserLine,
} from "react-icons/ri";

async function getDashboardStats() {
  const [totalCompanies, totalUsers, activeCompanies, totalProperties, apiCosts] =
    await Promise.all([
      db.company.count(),
      db.user.count(),
      db.company.count({ where: { status: "ACTIVE" } }),
      db.building.count(),
      (db as any).aPIUsageLog.aggregate({
        _sum: { totalCost: true },
        where: {
          createdAt: { gte: new Date(new Date().setDate(1)) },
        },
      }),
    ]);

  return {
    totalCompanies,
    totalUsers,
    activeCompanies,
    totalProperties,
    monthlyCosts: (apiCosts._sum.totalCost as number) || 0,
  };
}

async function getRecentActivity() {
  const [recentUsers, recentCompanies] = await Promise.all([
    db.user.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
    db.company.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
  ]);
  return { recentUsers, recentCompanies };
}

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: "var(--color-success)",
  TRIAL: "var(--color-primary)",
  SUSPENDED: "var(--color-warning)",
  INACTIVE: "var(--muted-foreground)",
};

export default async function SuperAdminDashboard() {
  const [stats, { recentUsers, recentCompanies }] = await Promise.all([
    getDashboardStats(),
    getRecentActivity(),
  ]);

  const statCards = [
    {
      label: "Εταιρείες",
      value: stats.totalCompanies,
      sub: `Ενεργές: ${stats.activeCompanies}`,
      subColor: "var(--color-success)",
      icon: RiBuildingLine,
      href: "/super-admin/settings/company",
    },
    {
      label: "Χρήστες",
      value: stats.totalUsers,
      sub: "Σε όλες τις εταιρείες",
      icon: RiGroupLine,
      href: "/super-admin/users",
    },
    {
      label: "Ακίνητα",
      value: stats.totalProperties,
      sub: "Κτίρια υπό διαχείριση",
      icon: RiHome3Line,
      href: "/super-admin/settings/company",
    },
    {
      label: "Κόστη API (μήνας)",
      value: `€${stats.monthlyCosts.toFixed(2)}`,
      sub: "Τρέχων μήνας",
      subColor: stats.monthlyCosts > 50 ? "var(--color-warning)" : "var(--muted-foreground)",
      icon: RiMoneyEuroCircleLine,
      href: "/super-admin/settings/costs",
    },
  ];

  const markers = await getPropertiesForMap();
  return (
    <DashboardTabs map={<PropertiesMap markers={markers} />}>
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.label}
              href={card.href}
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                padding: "20px 24px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                textDecoration: "none",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, color: "var(--muted-foreground)", fontWeight: 500 }}>
                  {card.label}
                </span>
                <Icon style={{ fontSize: 20, color: "var(--color-primary)", opacity: 0.7 }} />
              </div>
              <span style={{ fontSize: 28, fontWeight: 700, color: "var(--foreground)", lineHeight: 1 }}>
                {card.value}
              </span>
              {card.sub && (
                <span style={{ fontSize: 12, color: card.subColor || "var(--muted-foreground)" }}>
                  {card.sub}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Recent activity */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Recent Companies */}
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>
              Πρόσφατες Εταιρείες
            </h2>
            <Link href="/super-admin/settings/company" style={{ fontSize: 12, color: "var(--color-primary)", display: "flex", alignItems: "center", gap: 4, textDecoration: "none" }}>
              Όλες <RiArrowRightLine />
            </Link>
          </div>

          {recentCompanies.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 0", color: "var(--muted-foreground)", gap: 8 }}>
              <RiBuilding2Line style={{ fontSize: 32, opacity: 0.4 }} />
              <span style={{ fontSize: 13 }}>Δεν υπάρχουν εταιρείες ακόμα</span>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {recentCompanies.map((c) => (
                <div key={c.id} style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 12px",
                  background: "var(--bg-canvas)",
                  borderRadius: 6,
                }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: "var(--foreground)" }}>{c.name}</div>
                    <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{c.slug}</div>
                  </div>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: 20,
                    background: `${STATUS_COLOR[c.status] || "var(--muted-foreground)"}18`,
                    color: STATUS_COLOR[c.status] || "var(--muted-foreground)",
                  }}>
                    {c.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Users */}
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>
              Πρόσφατοι Χρήστες
            </h2>
            <Link href="/super-admin/users" style={{ fontSize: 12, color: "var(--color-primary)", display: "flex", alignItems: "center", gap: 4, textDecoration: "none" }}>
              Όλοι <RiArrowRightLine />
            </Link>
          </div>

          {recentUsers.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 0", color: "var(--muted-foreground)", gap: 8 }}>
              <RiUserLine style={{ fontSize: 32, opacity: 0.4 }} />
              <span style={{ fontSize: 13 }}>Δεν υπάρχουν χρήστες ακόμα</span>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {recentUsers.map((u) => (
                <div key={u.id} style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 12px",
                  background: "var(--bg-canvas)",
                  borderRadius: 6,
                }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: "var(--foreground)" }}>{u.name}</div>
                    <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{u.email}</div>
                  </div>
                  <span style={{
                    flexShrink: 0,
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "3px 10px",
                    borderRadius: 9999,
                    background: `${roleColor((u as any).role)}18`,
                    color: roleColor((u as any).role),
                    whiteSpace: "nowrap",
                  }}>
                    {roleLabel((u as any).role)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* System Status */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 24 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)", margin: "0 0 16px" }}>
          Κατάσταση Συστήματος
        </h2>
        <div style={{ display: "flex", gap: 40 }}>
          {[
            { label: "Βάση Δεδομένων", status: "Συνδεδεμένη" },
            { label: "API Services", status: "Λειτουργικά" },
            { label: "Πιστοποίηση", status: "Ενεργή" },
          ].map((item) => (
            <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <RiCheckboxCircleFill style={{ fontSize: 18, color: "var(--color-success)" }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: "var(--foreground)" }}>{item.label}</div>
                <div style={{ fontSize: 12, color: "var(--color-success)" }}>{item.status}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
    </DashboardTabs>
  );
}
