import { db } from "@/lib/db";
import Link from "next/link";
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
  RiHome3Line,
  RiToolsLine,
  RiAlarmWarningLine,
  RiMoneyEuroCircleLine,
  RiGroupLine,
  RiBuildingLine,
  RiCalendarCloseLine,
  RiUserLine,
  RiNotification2Line,
  RiCalendarLine,
  RiArrowRightLine,
} from "react-icons/ri";

async function getAdminContext(companyId: string | undefined) {
  const propWhere = companyId ? { companyId } : {};
  const [totalUnits, totalUsers, announcements] = await Promise.all([
    db.unit.count({ where: companyId ? { building: { companyId } } : {} }),
    db.user.count({ where: companyId ? { companyId } : {} }),
    db.announcement.count({ where: { building: propWhere, status: "ACTIVE" } }),
  ]);
  return { totalUnits, totalUsers, announcements };
}

const quickLinks = [
  { label: "Ενοικιαστές", href: "/admin/residents", icon: RiUserLine, color: "#8764B8" },
  { label: "Ανακοινώσεις", href: "/admin/announcements", icon: RiNotification2Line, color: "#0078D4" },
  { label: "Ημερολόγιο", href: "/admin/calendar", icon: RiCalendarLine, color: "#107C10" },
  { label: "Αναφορές", href: "/admin/reports", icon: RiBuildingLine, color: "#CA5D00" },
];

/**
 * Admin (company operations) dashboard content, scoped to `companyId`.
 * Rendered by the real /admin page and by the read-only role preview.
 */
export async function AdminHome({ companyId }: { companyId: string | undefined }) {
  const [ctx, managedBuildings, faults, revenue, outstanding, expiring] = await Promise.all([
    getAdminContext(companyId),
    getManagedBuildingsCount(companyId),
    getManagedFaultsSummary(companyId),
    getPlatformRevenue(companyId),
    getOutstandingInvoices(companyId),
    getExpiringSubscriptions(30, companyId),
  ]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h1 style={{ fontSize: "var(--fs-22)", fontWeight: 700, color: "var(--foreground)", margin: 0 }}>Πίνακας Διαχείρισης</h1>
        <p style={{ fontSize: "var(--fs-13)", color: "var(--muted-foreground)", marginTop: 4 }}>Λειτουργική εικόνα εταιρείας — βλάβες, εισπράξεις, λήξεις</p>
      </div>

      {/* Primary operational KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        <KpiCard label="Managed κτήρια" value={managedBuildings} sub="Υπό ενεργή διαχείριση" icon={RiHome3Line} accent="#038387" href="/admin/properties" />
        <KpiCard label="Ανοιχτές βλάβες" value={faults.open} sub={faults.urgent ? `${faults.urgent} επείγουσες` : "Καμία επείγουσα"} subColor={faults.urgent ? "var(--color-warning)" : undefined} icon={RiToolsLine} accent="var(--color-primary)" href="/admin/maintenance" />
        <KpiCard label="Σε καθυστέρηση SLA" value={faults.slaBreached} sub="Ξεπέρασαν το όριο" subColor={faults.slaBreached ? "#d13438" : undefined} icon={RiAlarmWarningLine} accent="#d13438" href="/admin/maintenance" />
        <KpiCard label="Εισπράξεις μήνα" value={formatEuro(revenue.monthTotal)} delta={revenue.deltaPct} sub={outstanding.amount > 0 ? `Ανεξόφλητα: ${formatEuro(outstanding.amount)}` : "Χωρίς οφειλές"} subColor={outstanding.amount > 0 ? "var(--color-warning)" : "var(--color-success)"} icon={RiMoneyEuroCircleLine} accent="var(--color-success)" href="/admin/customer-wallets" />
      </div>

      {/* Context stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        <KpiCard label="Μονάδες" value={ctx.totalUnits} sub="Σύνολο μονάδων" icon={RiHome3Line} accent="#038387" href="/admin/properties" />
        <KpiCard label="Χρήστες" value={ctx.totalUsers} sub="Ενεργά μέλη" icon={RiGroupLine} accent="#0078D4" href="/admin/residents" />
        <KpiCard label="Ενεργές ανακοινώσεις" value={ctx.announcements} sub="Δημοσιευμένες" icon={RiNotification2Line} accent="#8764B8" href="/admin/announcements" />
      </div>

      {/* Faults split by reporter role */}
      <ManagedFaultsPanel summary={faults} detailBase="/admin/maintenance" allHref="/admin/maintenance" title="Αιτήματα βλαβών ανά ρόλο" />

      {/* Revenue trend + expiring */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16 }}>
        <Panel title="Εισπράξεις (τελευταίοι 6 μήνες)" href="/admin/customer-wallets" hrefLabel="Εισπράξεις">
          <RevenueBars trend={revenue.trend} accent="var(--color-success)" />
        </Panel>

        <Panel title="Συνδρομές που λήγουν">
          {expiring.length === 0 ? (
            <EmptyState icon={RiCalendarCloseLine} text="Καμία λήξη στις επόμενες 30 ημέρες" />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 200, overflowY: "auto" }}>
              {expiring.slice(0, 10).map((e) => (
                <div key={`${e.kind}-${e.id}`} style={rowStyle}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: "var(--fs-13)", fontWeight: 600, color: "var(--foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {e.kind === "addon" ? "Πρόσθετο" : "Συνδρομή"} · {e.label}
                    </div>
                    <div style={{ fontSize: "var(--fs-12)", color: "var(--muted-foreground)" }}>{formatEuro(e.amount)}/μ</div>
                  </div>
                  <Pill label={e.daysLeft <= 0 ? "Έληξε" : `${e.daysLeft}μ`} color={e.daysLeft <= 7 ? "var(--color-warning)" : "var(--color-primary)"} />
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* Quick links */}
      <Panel title="Γρήγορες Ενέργειες">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link key={link.href} href={link.href} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 8, background: "var(--bg-canvas)", border: "1px solid var(--border)", textDecoration: "none", color: "var(--foreground)" }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: `${link.color}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon style={{ fontSize: "var(--fs-16)", color: link.color }} />
                </div>
                <span style={{ fontSize: "var(--fs-13)", fontWeight: 500 }}>{link.label}</span>
                <RiArrowRightLine style={{ marginLeft: "auto", fontSize: "var(--fs-14)", color: "var(--muted-foreground)" }} />
              </Link>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
