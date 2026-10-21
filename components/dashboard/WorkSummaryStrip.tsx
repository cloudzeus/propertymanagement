import Link from "next/link";
import { RiAlarmWarningLine, RiCalendarCheckLine, RiCalendarLine, RiUserUnfollowLine, RiArrowRightLine, RiTaskLine } from "react-icons/ri";
import { KpiCard } from "@/components/dashboard/kit";
import { loadWorkSummary, managedCustomerIds } from "@/lib/work/queries";

/**
 * «Εκκρεμότητες» — the work center's four KPIs on a role home, each linking
 * to /admin/work pre-filtered. Scoped like the work center itself (a MANAGER
 * to their customers); an EMPLOYEE lands on «Οι εργασίες μου».
 */
export async function WorkSummaryStrip({ role, userId }: { role: string; userId?: string }) {
  const uid = userId ?? "";
  const scope = { role, userId: uid, customerIds: uid ? await managedCustomerIds(uid, role) : null };
  const kpis = await loadWorkSummary(scope);
  const mine = role === "EMPLOYEE" ? "&mine=1" : "";
  const cards = [
    { key: "overdue", label: "Εκπρόθεσμα", value: kpis.overdue, sub: "Πέρασε η προθεσμία / SLA", icon: RiAlarmWarningLine, accent: "#d13438" },
    { key: "today", label: "Σήμερα", value: kpis.today, sub: "Με προθεσμία σήμερα", icon: RiCalendarCheckLine, accent: "var(--color-primary)" },
    { key: "week", label: "Αυτή την εβδομάδα", value: kpis.week, sub: "Δευτέρα–Κυριακή", icon: RiCalendarLine, accent: "#8764B8" },
    { key: "unassigned", label: "Χωρίς ανάθεση", value: kpis.unassigned, sub: "Βλάβες ευθύνης εταιρείας", icon: RiUserUnfollowLine, accent: "#CA5D00" },
  ];
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <RiTaskLine style={{ fontSize: "var(--fs-18)", color: "var(--color-primary)" }} />
        <h2 style={{ fontSize: "var(--fs-16)", fontWeight: 700, color: "var(--foreground)", margin: 0, flex: 1 }}>Εκκρεμότητες</h2>
        <Link href={`/admin/work${mine ? "?mine=1" : ""}`} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "var(--fs-12-5)", fontWeight: 600, color: "var(--color-primary)", textDecoration: "none" }}>
          Κέντρο εργασιών <RiArrowRightLine />
        </Link>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        {cards.map((c) => (
          <KpiCard key={c.key} label={c.label} value={c.value} sub={c.sub} icon={c.icon} accent={c.accent} href={`/admin/work?f=${c.key}${mine}`} />
        ))}
      </div>
    </section>
  );
}
