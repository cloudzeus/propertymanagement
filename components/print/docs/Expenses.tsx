import { PrintSheet, Signatures } from "@/components/print/PrintShell";
import type { PrintBrand } from "@/lib/print/brand";
import type { Period, PrintBuilding } from "@/lib/print/data";
import { eur, monthLabel, dateLabel, basisLabel } from "@/lib/print/format";

type Props = { brand: PrintBrand; building: PrintBuilding; period: Period };

/** Λίστα / ανάλυση εξόδων περιόδου — every παραστατικό with its distribution rule. */
export function ExpensesDoc({ brand, building, period }: Props) {
  const net = period.expenses.reduce((a, e) => a + (e.net ?? 0), 0);
  const vat = period.expenses.reduce((a, e) => a + (e.vat ?? 0), 0);
  const byCat = new Map<string, { amount: number; count: number; basis: string; tenantPct: number }>();
  for (const e of period.expenses) {
    const c = byCat.get(e.categoryName) ?? { amount: 0, count: 0, basis: e.basis, tenantPct: e.tenantPct };
    c.amount += e.amount; c.count += 1; byCat.set(e.categoryName, c);
  }
  return (
    <PrintSheet
      brand={brand} building={building}
      eyebrow="Κοινόχρηστα · Παραστατικά περιόδου"
      title="Ανάλυση εξόδων περιόδου"
      subtitle={<>Περίοδος <b>{monthLabel(period.month)}</b> · {period.expenses.length} παραστατικά · σύνολο <b>{eur(period.total)}</b></>}
      docNo={`ΑΕ-${period.month}`}
      meta={[{ k: "Περίοδος", v: monthLabel(period.month) }, { k: "Σύνολο", v: eur(period.total), s: net ? `Καθαρό ${eur(net)} · ΦΠΑ ${eur(vat)}` : undefined }]}
    >
      <section className="psec">
        <div className="psec-title">Παραστατικά</div>
        <table className="pt" style={{ fontSize: "8.5pt" }}>
          <thead><tr><th>#</th><th>Ημ/νία</th><th>Προμηθευτής · παραστατικό</th><th>Κατηγορία · κατανομή</th><th className="num">Καθαρό</th><th className="num">ΦΠΑ</th><th className="num">Σύνολο</th><th>Εξόφλ.</th></tr></thead>
          <tbody>
            {period.expenses.map((e, i) => (
              <tr key={e.id}>
                <td className="dim">{i + 1}</td>
                <td className="num">{dateLabel(e.documentDate)}</td>
                <td><div style={{ fontWeight: 600 }}>{e.supplierName ?? "—"}</div>{e.documentNumber && <div className="dim">Αρ. {e.documentNumber}</div>}{e.description && e.description !== e.supplierName && <div className="dim">{e.description}</div>}</td>
                <td><div>{e.categoryName}</div><div className="dim">{basisLabel(e.basis)} · ένοικοι {e.tenantPct}% / ιδιοκτήτες {e.ownerPct}%</div></td>
                <td className="num">{e.net != null ? eur(e.net) : "—"}</td>
                <td className="num">{e.vat != null ? eur(e.vat) : "—"}</td>
                <td className="num" style={{ fontWeight: 700 }}>{eur(e.amount)}</td>
                <td>{e.paid ? "Ναι" : "Όχι"}</td>
              </tr>
            ))}
            <tr className="total"><td colSpan={4}>Σύνολο περιόδου</td><td className="num">{net ? eur(net) : "—"}</td><td className="num">{vat ? eur(vat) : "—"}</td><td className="num">{eur(period.total)}</td><td /></tr>
          </tbody>
        </table>
      </section>
      <section className="psec">
        <div className="psec-title">Σύνοψη ανά κατηγορία</div>
        <table className="pt">
          <thead><tr><th>Κατηγορία</th><th>Βάση κατανομής</th><th className="num">Ένοικοι</th><th className="num">Παραστατικά</th><th className="num">Ποσό</th><th className="num">% συνόλου</th></tr></thead>
          <tbody>
            {[...byCat.entries()].sort((a, b) => b[1].amount - a[1].amount).map(([name, c]) => (
              <tr key={name}><td style={{ fontWeight: 600 }}>{name}</td><td>{basisLabel(c.basis)}</td><td className="num">{c.tenantPct}%</td><td className="num">{c.count}</td><td className="num">{eur(c.amount)}</td><td className="num">{period.total ? `${((c.amount / period.total) * 100).toLocaleString("el-GR", { maximumFractionDigits: 1 })}%` : "—"}</td></tr>
            ))}
          </tbody>
        </table>
      </section>
      <div className="dim" style={{ fontSize: "8.5pt", color: "#555" }}>Τα πρωτότυπα παραστατικά τηρούνται στο αρχείο της διαχείρισης και είναι διαθέσιμα προς έλεγχο από κάθε συνιδιοκτήτη.</div>
      <Signatures managerName={building.managerName} />
    </PrintSheet>
  );
}
