import { redirect } from "next/navigation";
import { getEffectiveSession } from "@/lib/auth-effective";
import { getOwnerAllocRows } from "@/lib/dashboard/owner-queries";
import { groupAllocationsByMonth } from "@/lib/dashboard/alloc-view";
import { formatEuro } from "@/lib/dashboard/aggregations";
import { StatTile, MoneyRow, EmptyState } from "@/components/dashboard";
import { RiMoneyEuroCircleLine, RiWallet3Line, RiFileTextLine } from "react-icons/ri";

export const metadata = { title: "Πληρωμές" };

const GR_MONTHS = [
  "Ιανουάριος", "Φεβρουάριος", "Μάρτιος", "Απρίλιος", "Μάιος", "Ιούνιος",
  "Ιούλιος", "Αύγουστος", "Σεπτέμβριος", "Οκτώβριος", "Νοέμβριος", "Δεκέμβριος",
];
function monthLabel(m: string): string {
  const [y, mo] = m.split("-").map(Number);
  return mo >= 1 && mo <= 12 ? `${GR_MONTHS[mo - 1]} ${y}` : m;
}

export default async function OwnerPaymentsPage() {
  const eff = await getEffectiveSession();
  if (!eff?.user?.id) redirect("/login");
  const userId = eff.user.id;

  const rows = await getOwnerAllocRows(userId);
  const { months, total, totalUnpaid } = groupAllocationsByMonth(rows);

  return (
    <div className="dash-page" style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 900 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--foreground)", margin: 0 }}>Πληρωμές</h1>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }} className="dash-grid">
        <StatTile
          label="Σύνολο οφειλών" value={formatEuro(totalUnpaid)} sub="Εκκρεμείς χρεώσεις"
          icon={RiMoneyEuroCircleLine} valueColor={totalUnpaid > 0 ? "var(--color-warning)" : "var(--foreground)"}
        />
        <StatTile label="Σύνολο χρεώσεων" value={formatEuro(total)} sub="Όλες οι περίοδοι" icon={RiWallet3Line} />
      </div>

      {months.length === 0 ? (
        <EmptyState icon={RiMoneyEuroCircleLine} label="Δεν υπάρχουν χρεώσεις κοινοχρήστων." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {months.map((g, i) => (
            <details key={g.month} open={i === 0} style={{
              background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
              boxShadow: "var(--shadow-card)", padding: 20,
            }}>
              <summary style={{
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between",
                gap: 12, fontSize: 15, fontWeight: 700, color: "var(--foreground)", flexWrap: "wrap",
              }}>
                <span>{monthLabel(g.month)}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)" }}>
                  {formatEuro(g.total)}{g.unpaid > 0 ? ` · Οφειλή ${formatEuro(g.unpaid)}` : ""}
                </span>
              </summary>

              <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 6 }}>
                {g.rows.map((r) => (
                  <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <MoneyRow title={r.description || r.unitLabel} subtitle={r.description ? r.unitLabel : undefined} amount={r.amount} paid={r.paid} />
                    </div>
                    {r.receiptUrl && (
                      <a href={r.receiptUrl} target="_blank" rel="noreferrer" title="Απόδειξη" style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center", width: 34, height: 34,
                        borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-canvas)",
                        color: "var(--foreground)", flexShrink: 0,
                      }}>
                        <RiFileTextLine />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
