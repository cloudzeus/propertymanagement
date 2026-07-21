import { db } from "@/lib/db";
import { roleLabel, roleColor } from "@/lib/roles-constants";
import {
  getPlatformRevenue,
  getOutstandingInvoices,
  getExpiringSubscriptions,
  getManagedFaultsSummary,
  getManagedBuildingsCount,
} from "@/lib/dashboard/platform";
import { formatEuro } from "@/lib/dashboard/aggregations";
import { KpiCard, Panel, RevenueBars, Pill, EmptyState, rowStyle, ManagedFaultsPanel } from "@/components/dashboard/kit";
import {
  RiMoneyEuroCircleLine,
  RiAlarmWarningLine,
  RiCalendarCloseLine,
  RiBuildingLine,
  RiGroupLine,
  RiHome3Line,
  RiCpuLine,
  RiUserLine,
} from "react-icons/ri";

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: "var(--color-success)",
  TRIAL: "var(--color-primary)",
  SUSPENDED: "var(--color-warning)",
  INACTIVE: "var(--muted-foreground)",
};

async function getContextStats() {
  const [totalCompanies, activeCompanies, totalUsers, apiCosts] = await Promise.all([
    db.company.count(),
    db.company.count({ where: { status: "ACTIVE" } }),
    db.user.count(),
    (db as any).aPIUsageLog.aggregate({
      _sum: { totalCost: true },
      where: { createdAt: { gte: new Date(new Date().setDate(1)) } },
    }),
  ]);
  return {
    totalCompanies,
    activeCompanies,
    totalUsers,
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

/**
 * Super-admin (platform) dashboard content — global scope, no session reads.
 * Rendered by the real /super-admin page and by the read-only role preview.
 */
export async function SuperAdminHome() {
  const [ctx, revenue, outstanding, expiring, faults, managedBuildings, { recentUsers, recentCompanies }] =
    await Promise.all([
      getContextStats(),
      getPlatformRevenue(),
      getOutstandingInvoices(),
      getExpiringSubscriptions(30),
      getManagedFaultsSummary(),
      getManagedBuildingsCount(),
      getRecentActivity(),
    ]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Primary KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        <KpiCard label="Έσοδα μήνα" value={formatEuro(revenue.monthTotal)} delta={revenue.deltaPct} sub={`MRR: ${formatEuro(revenue.mrr)}`} icon={RiMoneyEuroCircleLine} accent="var(--color-success)" href="/super-admin/billing" />
        <KpiCard label="Ανεξόφλητα" value={formatEuro(outstanding.amount)} sub={`${outstanding.count} τιμολόγια${outstanding.overdueCount ? ` · ${outstanding.overdueCount} ληξιπρόθεσμα` : ""}`} subColor={outstanding.overdueCount ? "var(--color-warning)" : undefined} icon={RiAlarmWarningLine} accent="var(--color-warning)" href="/super-admin/billing" />
        <KpiCard label="Συνδρομές που λήγουν" value={expiring.length} sub="Επόμενες 30 ημέρες" icon={RiCalendarCloseLine} accent="#CA5D00" href="/super-admin/billing" />
        <KpiCard label="Ενεργές εταιρείες" value={ctx.activeCompanies} sub={`Σύνολο: ${ctx.totalCompanies}`} subColor="var(--color-success)" icon={RiBuildingLine} accent="var(--color-primary)" href="/super-admin/settings/company" />
      </div>

      {/* Context stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        <KpiCard label="Χρήστες" value={ctx.totalUsers} sub="Σε όλες τις εταιρείες" icon={RiGroupLine} accent="#0078D4" href="/super-admin/users" />
        <KpiCard label="Managed κτήρια" value={managedBuildings} sub="Υπό ενεργή διαχείριση" icon={RiHome3Line} accent="#038387" href="/super-admin/properties" />
        <KpiCard label="Κόστη API (μήνας)" value={`€${ctx.monthlyCosts.toFixed(2)}`} sub="Τρέχων μήνας" subColor={ctx.monthlyCosts > 50 ? "var(--color-warning)" : undefined} icon={RiCpuLine} accent="#8764B8" href="/super-admin/settings/costs" />
      </div>

      {/* Revenue trend + expiring subscriptions */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16 }}>
        <Panel title="Έσοδα (τελευταίοι 6 μήνες)" href="/super-admin/billing" hrefLabel="Τιμολόγηση">
          <RevenueBars trend={revenue.trend} accent="var(--color-success)" />
        </Panel>

        <Panel title="Συνδρομές που λήγουν" href="/super-admin/billing">
          {expiring.length === 0 ? (
            <EmptyState icon={RiCalendarCloseLine} text="Καμία λήξη στις επόμενες 30 ημέρες" />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 260, overflowY: "auto" }}>
              {expiring.slice(0, 12).map((e) => (
                <div key={`${e.kind}-${e.id}`} style={rowStyle}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.companyName}</div>
                    <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                      {e.kind === "addon" ? "Πρόσθετο" : "Συνδρομή"} · {e.label} · {formatEuro(e.amount)}/μ
                    </div>
                  </div>
                  <Pill label={e.daysLeft <= 0 ? "Έληξε" : `${e.daysLeft}μ`} color={e.daysLeft <= 7 ? "var(--color-warning)" : "var(--color-primary)"} />
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* Managed-building faults, split by reporter */}
      <ManagedFaultsPanel summary={faults} detailBase="/admin/maintenance" allHref="/admin/maintenance" />

      {/* Recent activity */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Panel title="Πρόσφατες Εταιρείες" href="/super-admin/settings/company" hrefLabel="Όλες">
          {recentCompanies.length === 0 ? (
            <EmptyState icon={RiBuildingLine} text="Δεν υπάρχουν εταιρείες ακόμα" />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {recentCompanies.map((c) => (
                <div key={c.id} style={rowStyle}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: "var(--foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</div>
                    <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{c.slug}</div>
                  </div>
                  <Pill label={c.status} color={STATUS_COLOR[c.status] || "var(--muted-foreground)"} />
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Πρόσφατοι Χρήστες" href="/super-admin/users" hrefLabel="Όλοι">
          {recentUsers.length === 0 ? (
            <EmptyState icon={RiUserLine} text="Δεν υπάρχουν χρήστες ακόμα" />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {recentUsers.map((u) => (
                <div key={u.id} style={rowStyle}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: "var(--foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.name}</div>
                    <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{u.email}</div>
                  </div>
                  <Pill label={roleLabel((u as any).role)} color={roleColor((u as any).role)} />
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
