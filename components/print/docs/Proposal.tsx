import { PrintSheet, Signatures } from "@/components/print/PrintShell";
import type { PrintBrand } from "@/lib/print/brand";
import type { PrintBuilding } from "@/lib/print/data";
import { eur, mill, dateLabel, basisLabel } from "@/lib/print/format";

export type ProposalInput = {
  title: string; description: string; net: number; vatPct: number;
  basis: "GENERAL_MILLESIMES" | "ELEVATOR_MILLESIMES" | "HEATING_MILLESIMES" | "EQUAL_PER_UNIT";
  tenantPct: number; supplierName: string | null; warrantyMonths: number | null; reference: string | null; replyBy: Date; earliestDate: Date | null;
};
type Props = { brand: PrintBrand; building: PrintBuilding; p: ProposalInput };

/** Πρόταση δαπάνης προς έγκριση — cost, per-unit split, and the owners' vote slip. */
export function ProposalDoc({ brand, building, p }: Props) {
  const vat = Math.round(p.net * p.vatPct) / 100;
  const total = Math.round((p.net + vat) * 100) / 100;
  const weight = (u: PrintBuilding["units"][number]) =>
    p.basis === "EQUAL_PER_UNIT" ? 1 : p.basis === "ELEVATOR_MILLESIMES" ? (u.millesimesElevator ?? u.millesimes ?? 0) : p.basis === "HEATING_MILLESIMES" ? (u.millesimesHeating ?? u.millesimes ?? 0) : (u.millesimes ?? 0);
  const sumW = building.units.reduce((a, u) => a + weight(u), 0) || 1;
  const rows = building.units.map((u) => {
    const share = Math.round(((total * weight(u)) / sumW) * 100) / 100;
    const tenant = Math.round(((share * p.tenantPct) / 100) * 100) / 100;
    return { u, w: weight(u), share, tenant, owner: Math.round((share - tenant) * 100) / 100 };
  });
  const showSplit = p.tenantPct > 0;
  return (
    <PrintSheet
      brand={brand} building={building}
      eyebrow="Συνιδιοκτησία · Προς έγκριση"
      title="Πρόταση δαπάνης"
      subtitle={<><b>{p.title}</b> · συνολικό κόστος <b>{eur(total)}</b> με ΦΠΑ</>}
      docNo={p.reference ?? `ΠΔ-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`}
      meta={[{ k: "Κόστος (με ΦΠΑ)", v: eur(total), s: `Καθαρό ${eur(p.net)} + ΦΠΑ ${p.vatPct}%` }, { k: "Απάντηση έως", v: dateLabel(p.replyBy) }]}
    >
      <section className="psec">
        <div className="psec-title">Αντικείμενο</div>
        <div className="pprose" style={{ whiteSpace: "pre-wrap", fontSize: "10pt" }}>{p.description}</div>
      </section>
      <section className="psec">
        <div className="psec-title">Ανάλυση κόστους</div>
        <div className="pkv">
          {p.supplierName && <><span className="k">Εκτέλεση από</span><span>{p.supplierName}</span></>}
          <span className="k">Καθαρή αξία</span><span>{eur(p.net)}</span>
          <span className="k">ΦΠΑ {p.vatPct}%</span><span>{eur(vat)}</span>
          <span className="k">Σύνολο</span><span><b>{eur(total)}</b></span>
          {p.warrantyMonths != null && <><span className="k">Εγγύηση</span><span>{p.warrantyMonths} μήνες</span></>}
          {p.earliestDate && <><span className="k">Δυνατή έναρξη</span><span>{dateLabel(p.earliestDate)}</span></>}
          <span className="k">Κατανομή</span><span>{basisLabel(p.basis)}{showSplit ? ` · ένοικοι ${p.tenantPct}% / ιδιοκτήτες ${100 - p.tenantPct}%` : " · βαρύνει αποκλειστικά τους ιδιοκτήτες"}</span>
        </div>
      </section>
      <section className="psec">
        <div className="psec-title">Αναλογία ανά διαμέρισμα</div>
        <table className="pt">
          <thead><tr><th>Διαμ.</th><th>Ιδιοκτήτης</th><th className="num">{p.basis === "EQUAL_PER_UNIT" ? "Μερίδιο" : "Χιλιοστά"}</th><th className="num">Ποσό</th>{showSplit && <><th className="num">Ιδιοκτήτη</th><th className="num">Ενοίκου</th></>}</tr></thead>
          <tbody>
            {rows.map(({ u, w, share, owner, tenant }) => (
              <tr key={u.id}><td style={{ fontWeight: 700 }}>{u.unitNumber}</td><td>{u.ownerName ?? "—"}</td><td className="num">{p.basis === "EQUAL_PER_UNIT" ? `1/${building.units.length}` : mill(w)}</td><td className="num" style={{ fontWeight: 700 }}>{eur(share)}</td>{showSplit && <><td className="num">{eur(owner)}</td><td className="num">{eur(tenant)}</td></>}</tr>
            ))}
            <tr className="total"><td colSpan={2}>Σύνολο</td><td className="num">{p.basis === "EQUAL_PER_UNIT" ? "" : mill(sumW)}</td><td className="num">{eur(rows.reduce((a, r) => a + r.share, 0))}</td>{showSplit && <><td className="num">{eur(rows.reduce((a, r) => a + r.owner, 0))}</td><td className="num">{eur(rows.reduce((a, r) => a + r.tenant, 0))}</td></>}</tr>
          </tbody>
        </table>
      </section>
      <section className="psec">
        <div className="psec-title">Έγκριση συνιδιοκτητών</div>
        <p style={{ margin: "0 0 4px", fontSize: "9pt" }}>Παρακαλούμε δηλώστε τη θέση σας έως <b>{dateLabel(p.replyBy)}</b> (υπογράφοντας παρακάτω ή μέσω της εφαρμογής). Η δαπάνη εγκρίνεται με την πλειοψηφία που ορίζει ο κανονισμός της πολυκατοικίας και ο Ν. 3741/1929.</p>
        <table className="pt">
          <thead><tr><th>Διαμ.</th><th>Ιδιοκτήτης</th><th className="num">Χιλ.</th><th style={{ width: 120 }}>Ψήφος</th><th style={{ width: 160 }}>Υπογραφή · ημερομηνία</th></tr></thead>
          <tbody>
            {rows.map(({ u }) => (
              <tr key={u.id} style={{ height: 24 }}><td style={{ fontWeight: 700 }}>{u.unitNumber}</td><td>{u.ownerName ?? "—"}</td><td className="num">{mill(u.millesimes)}</td><td style={{ whiteSpace: "nowrap" }}><span className="pcheck" />Ναι &nbsp;&nbsp; <span className="pcheck" />Όχι</td><td /></tr>
            ))}
          </tbody>
        </table>
      </section>
      <Signatures managerName={building.managerName} />
    </PrintSheet>
  );
}
