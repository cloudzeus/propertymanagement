import { PrintSheet, Signatures } from "@/components/print/PrintShell";
import type { PrintBrand } from "@/lib/print/brand";
import type { Period, PrintBuilding } from "@/lib/print/data";
import { eur, monthLabel, dateLabel, methodLabel } from "@/lib/print/format";

type Prior = Map<string, { owner: number; tenant: number; months: string[] }>;
type Row = { unitNumber: string; name: string | null; charged: number; paid: number; paidAt: Date | null; methods: string; priorDue: number; priorMonths: string[] };
const sum = (rs: Row[], f: (r: Row) => number) => rs.reduce((a, r) => a + f(r), 0);
type Props = { brand: PrintBrand; building: PrintBuilding; period: Period; prior: Prior; dueDate: Date };

/** Κατάσταση πληρωμών & οφειλών περιόδου — owners and tenants, with carried-over dues. */
export function PaymentsDoc({ brand, building, period, prior, dueDate }: Props) {
  const rowsFor = (party: "owner" | "tenant"): Row[] => building.units.map((u) => {
    let charged = 0, paid = 0; const dates: Date[] = []; const methods = new Set<string>();
    for (const e of period.expenses) {
      const a = e.allocations.find((x) => x.unitId === u.id);
      if (!a) continue;
      const amt = party === "owner" ? a.ownerAmount : a.tenantAmount;
      const isPaid = party === "owner" ? a.ownerPaid : a.tenantPaid;
      if (amt <= 0) continue;
      charged += amt;
      if (isPaid) { paid += amt; const d = party === "owner" ? a.ownerPaidAt : a.tenantPaidAt; if (d) dates.push(d); const m = party === "owner" ? a.ownerMethod : a.tenantMethod; if (m) methods.add(methodLabel(m)); }
    }
    const p = prior.get(u.id);
    return { unitNumber: u.unitNumber, name: party === "owner" ? u.ownerName : (u.residentId && u.residentId === u.ownerId ? "Ιδιοκατοίκηση" : u.residentName), charged, paid, paidAt: dates.sort((a, b) => b.getTime() - a.getTime())[0] ?? null, methods: [...methods].join(", "), priorDue: p ? (party === "owner" ? p.owner : p.tenant) : 0, priorMonths: p?.months ?? [] };
  }).filter((r) => r.charged > 0 || r.priorDue > 0);
  const owners = rowsFor("owner"), tenants = rowsFor("tenant");
  const charged = sum(owners, (r) => r.charged) + sum(tenants, (r) => r.charged);
  const paid = sum(owners, (r) => r.paid) + sum(tenants, (r) => r.paid);
  const priorAll = sum(owners, (r) => r.priorDue) + sum(tenants, (r) => r.priorDue);

  return (
    <PrintSheet
      brand={brand} building={building}
      eyebrow="Κοινόχρηστα · Εισπράξεις & οφειλές"
      title="Κατάσταση πληρωμών"
      subtitle={<>Περίοδος <b>{monthLabel(period.month)}</b> · προθεσμία εξόφλησης {dateLabel(dueDate)}</>}
      docNo={`ΚΠ-${period.month}`}
      meta={[{ k: "Περίοδος", v: monthLabel(period.month) }, { k: "Εισπράχθηκαν", v: `${eur(paid)} / ${eur(charged)}`, s: charged ? `${Math.round((paid / charged) * 100)}% της περιόδου` : undefined }]}
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
        {[["Χρεώσεις περιόδου", eur(charged)], ["Εισπράχθηκαν", eur(paid)], ["Εκκρεμούν (περίοδος)", eur(charged - paid)], ["Προηγούμενες οφειλές", eur(priorAll)]].map(([k, v]) => (
          <div key={k} className="pbox" style={{ padding: "7px 10px" }}><div className="pdoc-eyebrow">{k}</div><div style={{ fontSize: "13pt", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{v}</div></div>
        ))}
      </div>
      <PartyTable title="Ιδιοκτήτες" rows={owners} who="Ιδιοκτήτης" />
      <PartyTable title="Ένοικοι" rows={tenants} who="Ένοικος" />
      <div className="dim" style={{ fontSize: "8.5pt", color: "#555" }}>Οι πληρωμές καταχωρούνται από τη διαχείριση κατά την είσπραξη. Οι προηγούμενες οφειλές αφορούν ανεξόφλητες αναλογίες παλαιότερων περιόδων.</div>
      <Signatures managerName={building.managerName} />
    </PrintSheet>
  );
}

function PartyTable({ title, rows, who }: { title: string; rows: Row[]; who: string }) {
  return (
    <section className="psec">
      <div className="psec-title">{title}</div>
      {rows.length === 0 ? <div className="dim" style={{ padding: "6px 0", color: "#555" }}>Καμία χρέωση για {who} αυτή την περίοδο.</div> : (
        <table className="pt" style={{ fontSize: "8.5pt" }}>
          <thead><tr><th>Διαμ.</th><th>{who}</th><th className="num">Χρέωση</th><th className="num">Εξοφλ.</th><th>Πληρωμή</th><th className="num">Υπόλοιπο</th><th className="num">Προηγ. οφειλές</th><th className="num">Συν. υπόλοιπο</th></tr></thead>
          <tbody>
            {rows.map((r) => {
              const rest = r.charged - r.paid;
              return (
                <tr key={r.unitNumber}>
                  <td style={{ fontWeight: 700 }}>{r.unitNumber}</td><td>{r.name ?? "—"}</td>
                  <td className="num">{eur(r.charged)}</td><td className="num">{r.paid > 0 ? eur(r.paid) : "—"}</td>
                  <td className="dim">{r.paidAt ? `${dateLabel(r.paidAt)} · ${r.methods}` : "—"}</td>
                  <td className="num" style={{ fontWeight: rest > 0 ? 700 : 400 }}>{rest > 0 ? eur(rest) : "0,00 €"}</td>
                  <td className="num">{r.priorDue > 0 ? <>{eur(r.priorDue)}<div className="dim">{r.priorMonths.map(monthLabel).join(", ")}</div></> : "—"}</td>
                  <td className="num" style={{ fontWeight: 800 }}>{eur(rest + r.priorDue)}</td>
                </tr>
              );
            })}
            <tr className="total"><td colSpan={2}>Σύνολο</td><td className="num">{eur(sum(rows, (r) => r.charged))}</td><td className="num">{eur(sum(rows, (r) => r.paid))}</td><td /><td className="num">{eur(sum(rows, (r) => r.charged - r.paid))}</td><td className="num">{eur(sum(rows, (r) => r.priorDue))}</td><td className="num">{eur(sum(rows, (r) => r.charged - r.paid + r.priorDue))}</td></tr>
          </tbody>
        </table>
      )}
    </section>
  );
}
