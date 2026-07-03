import { auth } from "@/auth";
import { getBuildingManagerDashboard } from "@/lib/dashboard/queries";
import { formatEuro } from "@/lib/dashboard/aggregations";
import {
  Hero, StatTile, SectionCard, Gauge, MoneyRow, MiniBars, TicketList, EmptyState,
} from "@/components/dashboard";
import { RiMoneyEuroCircleLine, RiUserUnfollowLine, RiToolsLine, RiWallet3Line } from "react-icons/ri";

export default async function BuildingManagerDashboard() {
  const session = await auth();
  const userId = (session?.user as any)?.id ?? "";
  const {
    buildings, monthAllocations, collection, debtors, debtorAmount,
    expenses, expensesTotal, trend, tickets,
  } = await getBuildingManagerDashboard(userId);
  const buildingName = buildings.map((b) => b.name).join(", ") || "Οι πολυκατοικίες μου";

  return (
    <div className="dash-page" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Hero title={buildingName} subtitle={`Εισπράξεις μήνα: ${formatEuro(collection.collected)} / ${formatEuro(collection.total)} · ${collection.pct}%`} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }} className="dash-grid">
        <StatTile label="Εισπράξεις μήνα" value={`${collection.pct}%`} sub={formatEuro(collection.collected)}
          icon={RiMoneyEuroCircleLine} />
        <StatTile label="Οφειλέτες" value={debtors.length} sub={formatEuro(debtorAmount)} icon={RiUserUnfollowLine}
          valueColor={debtors.length > 0 ? "var(--color-warning)" : "var(--foreground)"} />
        <StatTile label="Ανοιχτά αιτήματα" value={tickets.length} sub="Συντηρήσεις" icon={RiToolsLine} />
        <StatTile label="Έξοδα μήνα" value={formatEuro(expensesTotal)} sub={`${expenses.length} καταχωρήσεις`}
          icon={RiWallet3Line} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }} className="dash-cols">
        <SectionCard title="Κατάσταση εισπράξεων ανά μονάδα">
          {monthAllocations.length === 0 ? (
            <EmptyState icon={RiMoneyEuroCircleLine} label="Δεν έχουν εκδοθεί κοινόχρηστα αυτόν τον μήνα" />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {monthAllocations.slice(0, 8).map((a) => (
                <MoneyRow key={a.id} title={`Μονάδα ${a.unit.unitNumber}`}
                  amount={Number(a.tenantAmount) + Number(a.ownerAmount)}
                  paid={a.tenantPaid && a.ownerPaid} />
              ))}
            </div>
          )}
        </SectionCard>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <SectionCard title="Εισπράξεις">
            <Gauge value={collection.collected} max={collection.total} big={`${collection.pct}%`} unit="εισπράχθηκαν" />
          </SectionCard>
          <SectionCard title="Εισπράξεις ανά μήνα"><MiniBars data={trend} /></SectionCard>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="dash-cols">
        <SectionCard title="Ανοιχτά αιτήματα συντήρησης">
          <TicketList tickets={tickets.map((t) => ({ id: t.id, title: t.title, status: t.status, priority: t.priority, createdAt: t.createdAt }))} />
        </SectionCard>
        <SectionCard title="Έξοδα μήνα">
          {expenses.length === 0 ? (
            <EmptyState icon={RiWallet3Line} label="Δεν υπάρχουν έξοδα" />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {expenses.map((e) => (
                <MoneyRow key={e.id} title={e.description || e.category || "Έξοδο"} subtitle={e.supplierName || e.month}
                  amount={Number(e.amount)} paid={e.paid} />
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
