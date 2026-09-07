import { PrintSheet, Signatures } from "@/components/print/PrintShell";
import type { PrintBrand } from "@/lib/print/brand";
import type { Period, PrintBuilding } from "@/lib/print/data";
import { GROUP_LABELS, type StatementGroupKey } from "@/lib/building/statement";
import { eur, mill, monthLabel, dateLabel } from "@/lib/print/format";

type Props = { brand: PrintBrand; building: PrintBuilding; period: Period; dueDate: Date };

/** Συγκεντρωτική κατάσταση κοινοχρήστων — all units of the period on one sheet. */
export function SummaryDoc({ brand, building, period, dueDate }: Props) {
  const keys = (["A", "B", "C", "D", "E"] as StatementGroupKey[]).filter((k) => period.statements.some((s) => s.groups.some((g) => g.key === k)));
  const groupTotal = (k: StatementGroupKey) => period.statements.reduce((a, s) => a + (s.groups.find((g) => g.key === k)?.buildingTotal ?? 0), 0) / Math.max(1, period.statements.filter((s) => s.groups.some((g) => g.key === k)).length);
  const unitById = new Map(building.units.map((u) => [u.id, u]));
  const sumMill = building.units.reduce((a, u) => a + (u.millesimes ?? 0), 0);
  return (
    <PrintSheet
      brand={brand} building={building}
      eyebrow={`Κοινόχρηστα · ${period.issued ? "Εκδοθείσα περίοδος" : "Προσωρινός υπολογισμός"}`}
      title="Συγκεντρωτική κατάσταση κοινοχρήστων"
      subtitle={<>Περίοδος <b>{monthLabel(period.month)}</b> · {building.units.length} μονάδες · {period.expenses.length} παραστατικά</>}
      docNo={`ΣΚ-${period.month}`}
      meta={[{ k: "Περίοδος", v: monthLabel(period.month) }, { k: "Σύνολο δαπανών", v: eur(period.total), s: `Προθεσμία ${dateLabel(dueDate)}` }]}
    >
      <section className="psec">
        <div className="psec-title">Δαπάνες περιόδου ανά ομάδα</div>
        <table className="pt">
          <thead><tr><th>Ομάδα</th><th className="num">Ποσό</th><th className="num">Βαρύνει ιδιοκτήτες</th><th className="num">Βαρύνει ενοίκους</th></tr></thead>
          <tbody>
            {keys.map((k) => {
              const owner = period.statements.reduce((a, s) => a + (s.groups.find((g) => g.key === k)?.unitOwner ?? 0), 0);
              const tenant = period.statements.reduce((a, s) => a + (s.groups.find((g) => g.key === k)?.unitTenant ?? 0), 0);
              return <tr key={k}><td style={{ fontWeight: 700 }}>{GROUP_LABELS[k]}</td><td className="num">{eur(groupTotal(k))}</td><td className="num">{owner > 0 ? eur(owner) : "—"}</td><td className="num">{tenant > 0 ? eur(tenant) : "—"}</td></tr>;
            })}
            <tr className="total"><td>Σύνολο περιόδου</td><td className="num">{eur(period.total)}</td><td className="num">{eur(period.ownerTotal)}</td><td className="num">{eur(period.tenantTotal)}</td></tr>
          </tbody>
        </table>
      </section>

      <section className="psec">
        <div className="psec-title">Κατανομή ανά διαμέρισμα</div>
        <table className="pt" style={{ fontSize: "8.5pt" }}>
          <thead>
            <tr>
              <th>Διαμ.</th><th>Ιδιοκτήτης / Ένοικος</th><th className="num">Χιλ.</th>
              {keys.map((k) => <th key={k} className="num">{GROUP_LABELS[k].slice(0, 2)}</th>)}
              <th className="num">Σύνολο</th><th className="num">Ιδιοκτ.</th><th className="num">Ενοίκ.</th>
            </tr>
          </thead>
          <tbody>
            {period.statements.map((s) => {
              const u = unitById.get(s.unitId)!;
              return (
                <tr key={s.unitId}>
                  <td style={{ fontWeight: 700 }}>{s.unitNumber}</td>
                  <td><div>{u.ownerName ?? "—"}</div>{u.residentId && u.residentId !== u.ownerId && <div className="dim">{u.residentName}</div>}</td>
                  <td className="num">{mill(u.millesimes)}</td>
                  {keys.map((k) => { const g = s.groups.find((x) => x.key === k); return <td key={k} className="num">{g ? eur(g.unitAmount) : "—"}</td>; })}
                  <td className="num" style={{ fontWeight: 700 }}>{eur(s.total)}</td>
                  <td className="num">{s.ownerTotal > 0 ? eur(s.ownerTotal) : "—"}</td>
                  <td className="num">{s.tenantTotal > 0 ? eur(s.tenantTotal) : "—"}</td>
                </tr>
              );
            })}
            <tr className="total">
              <td colSpan={2}>Σύνολο</td><td className="num">{mill(sumMill)}</td>
              {keys.map((k) => <td key={k} className="num">{eur(period.statements.reduce((a, s) => a + (s.groups.find((g) => g.key === k)?.unitAmount ?? 0), 0))}</td>)}
              <td className="num">{eur(period.statements.reduce((a, s) => a + s.total, 0))}</td>
              <td className="num">{eur(period.ownerTotal)}</td><td className="num">{eur(period.tenantTotal)}</td>
            </tr>
          </tbody>
        </table>
        <div className="dim" style={{ fontSize: "8pt", marginTop: 4, color: "#555" }}>Ομάδες: Α Κοινόχρηστα · Β Ανελκυστήρας · Γ Θέρμανση · Δ Λοιπά (ισόποσα) · Ε Έξοδα συνιδιοκτησίας (μόνο ιδιοκτήτες).</div>
      </section>
      <Signatures managerName={building.managerName} />
    </PrintSheet>
  );
}
