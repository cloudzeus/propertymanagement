import { redirect } from "next/navigation";
import { getEffectiveSession } from "@/lib/auth-effective";
import { getOwnerDashboard } from "@/lib/dashboard/queries";
import { getOwnerBuildingIds } from "@/lib/dashboard/owner-queries";
import { formatEuro } from "@/lib/dashboard/aggregations";
import {
  Hero, StatTile, SectionCard, Gauge, MiniBars, TicketList, StatusChip, EmptyState,
} from "@/components/dashboard";
import { AutoRefresh } from "@/components/realtime/AutoRefresh";
import { RiHome3Line, RiMoneyEuroCircleLine, RiPieChartLine, RiToolsLine } from "react-icons/ri";

export default async function OwnerDashboard() {
  const eff = await getEffectiveSession();
  if (!eff?.user?.id) redirect("/login");
  const userId = eff.user.id;
  const { units, occ, owed, trend, tickets } = await getOwnerDashboard(userId);
  const buildingIds = await getOwnerBuildingIds(userId);
  const firstName = eff.user.name?.split(" ")[0] ?? "";

  return (
    <div className="dash-page" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {buildingIds.slice(0, 5).map((id) => (
        <AutoRefresh key={id} buildingId={id} />
      ))}
      <Hero
        title={`Καλησπέρα, ${firstName}`}
        subtitle={`${occ.total} ${occ.total === 1 ? "ακίνητο" : "ακίνητα"} · ${occ.rate}% πληρότητα`}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }} className="dash-grid">
        <StatTile label="Ιδιοκτησίες" value={occ.total} sub="Μονάδες μου" icon={RiHome3Line} href="/owner/units" />
        <StatTile label="Ενοικιασμένες" value={occ.occupied} sub={`${occ.vacant} κενές`} icon={RiPieChartLine}
          href="/owner/units" />
        <StatTile label="Οφειλές μου" value={formatEuro(owed)} sub="Κοινόχρηστα ιδιοκτήτη" icon={RiMoneyEuroCircleLine}
          href="/owner/payments" />
        <StatTile label="Ανοιχτά αιτήματα" value={tickets.length} sub="Στα ακίνητά μου" icon={RiToolsLine}
          href="/owner/requests" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }} className="dash-cols">
        <SectionCard title="Οι μονάδες μου" viewAllHref="/owner/units">
          {units.length === 0 ? (
            <EmptyState icon={RiHome3Line} label="Δεν υπάρχουν καταχωρημένες μονάδες" />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {units.slice(0, 8).map((u) => (
                <div key={u.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 14px", background: "var(--bg-canvas)", borderRadius: 8 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: "var(--foreground)" }}>{u.unitNumber}</div>
                    <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{u.building?.name}</div>
                  </div>
                  <StatusChip tone={u.residentId ? "success" : "warning"}>
                    {u.residentId ? "Ενοικιασμένο" : "Κενό"}
                  </StatusChip>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <SectionCard title="Πληρότητα">
            <Gauge value={occ.occupied} max={occ.total} big={`${occ.rate}%`} unit="ενοικιασμένες" />
          </SectionCard>
          <SectionCard title="Χρεώσεις ανά μήνα">
            <MiniBars data={trend} />
          </SectionCard>
        </div>
      </div>

      <SectionCard title="Ανοιχτά αιτήματα συντήρησης" viewAllHref="/owner/requests">
        <TicketList tickets={tickets.map((t) => ({ id: t.id, title: t.title, status: t.status, priority: t.priority, createdAt: t.createdAt }))} />
      </SectionCard>
    </div>
  );
}
