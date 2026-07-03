import { auth } from "@/auth";
import { getResidentDashboard } from "@/lib/dashboard/queries";
import { formatEuro } from "@/lib/dashboard/aggregations";
import {
  Hero, StatTile, SectionCard, MoneyRow, MiniBars, TicketList, EmptyState, PayNowButton,
} from "@/components/dashboard";
import { RiMoneyEuroCircleLine, RiCalendarLine, RiToolsLine, RiNotification2Line } from "react-icons/ri";

export default async function PortalDashboard() {
  const session = await auth();
  const userId = (session?.user as any)?.id ?? "";
  const companyId = (session?.user as any)?.companyId;
  const { unit, allocations, balance, trend, tickets, announcements } = await getResidentDashboard(userId, companyId);
  const firstName = session?.user?.name?.split(" ")[0] ?? "";
  const currentDue = allocations.find((a) => !a.tenantPaid);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Hero
        title={`Καλώς ήρθατε, ${firstName}`}
        subtitle={unit ? `${unit.building?.name} · ${unit.unitNumber}` : "Πύλη ενοικιαστή"}
        aside={balance > 0 ? <PayNowButton amount={balance} /> : undefined}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }} className="dash-grid">
        <StatTile label="Υπόλοιπο κοινοχρήστων" value={formatEuro(balance)} sub={balance > 0 ? "Προς πληρωμή" : "Ενημερωμένο"}
          icon={RiMoneyEuroCircleLine} tone={balance > 0 ? "var(--color-warning)" : "var(--color-success)"} />
        <StatTile label="Τρέχουσα δόση" value={currentDue ? formatEuro(Number(currentDue.tenantAmount)) : "—"}
          sub={currentDue ? currentDue.expense.month : "Καμία εκκρεμότητα"} icon={RiCalendarLine} />
        <StatTile label="Αιτήματά μου" value={tickets.length} sub="Ανοιχτά" icon={RiToolsLine}
          tone="var(--color-danger)" href="/portal/requests" />
        <StatTile label="Ανακοινώσεις" value={announcements.length} sub="Ενεργές" icon={RiNotification2Line}
          tone="var(--color-accent)" href="/portal/announcements" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }} className="dash-cols">
        <SectionCard title="Ιστορικό κοινοχρήστων" viewAllHref="/portal/payments">
          {allocations.length === 0 ? (
            <EmptyState icon={RiMoneyEuroCircleLine} label="Δεν υπάρχουν χρεώσεις" />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {allocations.slice(0, 6).map((a) => (
                <MoneyRow key={a.id} title={a.expense.description || `Κοινόχρηστα ${a.expense.month}`}
                  subtitle={a.expense.month} amount={Number(a.tenantAmount)} paid={a.tenantPaid} />
              ))}
            </div>
          )}
        </SectionCard>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <SectionCard title="Κοινόχρηστα ανά μήνα"><MiniBars data={trend} /></SectionCard>
          <SectionCard title="Ανακοινώσεις" viewAllHref="/portal/announcements">
            {announcements.length === 0 ? (
              <EmptyState icon={RiNotification2Line} label="Δεν υπάρχουν ανακοινώσεις" />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {announcements.map((ann) => (
                  <div key={ann.id} style={{ padding: "12px 14px", background: "var(--bg-canvas)", borderRadius: 8,
                    borderLeft: "3px solid var(--color-accent)" }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: "var(--foreground)" }}>{ann.title}</div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      </div>

      <SectionCard title="Ανοιχτά αιτήματα συντήρησης" viewAllHref="/portal/requests">
        <TicketList tickets={tickets.map((t) => ({ id: t.id, title: t.title, status: t.status, priority: t.priority, createdAt: t.createdAt }))} />
      </SectionCard>
    </div>
  );
}
