import { PrintSheet, Signatures } from "@/components/print/PrintShell";
import type { PrintBrand } from "@/lib/print/brand";
import type { Period, PrintBuilding, PrintUnit } from "@/lib/print/data";
import type { UnitStatement } from "@/lib/building/statement";
import { eur, mill, monthLabel, dateLabel, floorLabel, unitTypeLabel, num } from "@/lib/print/format";

type Props = { brand: PrintBrand; building: PrintBuilding; period: Period; unit: PrintUnit; statement: UnitStatement; dueDate: Date };

/** Ειδοποιητήριο κοινοχρήστων — one sheet per apartment (owner + tenant split). */
export function NoticeDoc({ brand, building, period, unit, statement, dueDate }: Props) {
  const settled = period.expenses.every((e) => { const a = e.allocations.find((x) => x.unitId === unit.id); return !a || ((a.ownerAmount === 0 || a.ownerPaid) && (a.tenantAmount === 0 || a.tenantPaid)); });
  const readings = period.heating.filter((h) => h.unitId === unit.id);
  const unitLine = [unitTypeLabel(unit.unitType), floorLabel(unit.floor), unit.areaSqm ? `${num(unit.areaSqm, 0)} τ.μ.` : null].filter(Boolean).join(" · ");
  const buildingTotal = statement.groups.reduce((a, g) => a + g.buildingTotal, 0);
  return (
    <PrintSheet
      brand={brand} building={building}
      eyebrow={`Κοινόχρηστα · ${period.issued ? "Εκδοθείσα περίοδος" : "Προσωρινός υπολογισμός"}`}
      title="Ειδοποιητήριο κοινοχρήστων"
      subtitle={<>Περίοδος <b>{monthLabel(period.month)}</b> · Διαμέρισμα <b>{unit.unitNumber}</b>{unitLine ? ` · ${unitLine}` : ""}</>}
      docNo={`ΕΚ-${period.month}-${unit.unitNumber}`}
      meta={[
        { k: "Περίοδος", v: monthLabel(period.month) },
        { k: "Διαμέρισμα", v: unit.unitNumber, s: unitLine },
      ]}
    >
      <div className="pbox" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <div><div className="pdoc-eyebrow">Ιδιοκτήτης</div><div style={{ fontWeight: 700 }}>{unit.ownerName ?? "—"}</div></div>
        <div><div className="pdoc-eyebrow">Ένοικος</div><div style={{ fontWeight: 700 }}>{unit.residentId && unit.residentId === unit.ownerId ? "Ιδιοκατοίκηση" : unit.residentName ?? "—"}</div></div>
        <div>
          <div className="pdoc-eyebrow">Χιλιοστά</div>
          <div style={{ fontSize: "9pt", lineHeight: 1.5 }}>Κοινόχρ. <b>{mill(unit.millesimes)}</b> · Ανελκ. <b>{mill(unit.millesimesElevator)}</b> · Θέρμ. <b>{mill(unit.millesimesHeating)}</b></div>
        </div>
      </div>

      {statement.groups.length === 0 ? (
        <div className="pbox soft" style={{ textAlign: "center", padding: 28, color: "#555" }}>Δεν υπάρχουν δαπάνες για το διαμέρισμα {unit.unitNumber} την περίοδο {monthLabel(period.month)}.</div>
      ) : (
        <>
          <section className="psec">
            <div className="psec-title">Ανάλυση δαπανών κτηρίου</div>
            <table className="pt">
              <thead><tr><th>Δαπάνη</th><th className="num" style={{ width: 110 }}>Σύνολο κτηρίου</th><th className="num" style={{ width: 110 }}>Αναλογία διαμ. {unit.unitNumber}</th></tr></thead>
              <tbody>
                {statement.groups.map((g) => (
                  <GroupRows key={g.key} g={g} />
                ))}
                <tr className="total"><td>Σύνολο δαπανών περιόδου</td><td className="num">{eur(buildingTotal)}</td><td className="num key">{eur(statement.total)}</td></tr>
              </tbody>
            </table>
          </section>

          <section className="psec">
            <div className="psec-title">Αναλογία διαμερίσματος {unit.unitNumber}</div>
            <table className="pt">
              <thead><tr><th>Ομάδα δαπανών</th><th className="num" style={{ width: 90 }}>Χιλιοστά</th><th className="num" style={{ width: 100 }}>Ποσό αναλογίας</th><th className="num" style={{ width: 100 }}>Ιδιοκτήτη</th><th className="num" style={{ width: 100 }}>Ενοίκου</th></tr></thead>
              <tbody>
                {statement.groups.map((g) => (
                  <tr key={g.key}><td style={{ fontWeight: 700 }}>{g.label}</td><td className="num">{mill(g.appliedMillesimes)}</td><td className="num" style={{ fontWeight: 700 }}>{eur(g.unitAmount)}</td><td className="num">{g.unitOwner > 0 ? eur(g.unitOwner) : "—"}</td><td className="num">{g.unitTenant > 0 ? eur(g.unitTenant) : "—"}</td></tr>
                ))}
                <tr className="total"><td>Σύνολο αναλογίας</td><td /><td className="num">{eur(statement.total)}</td><td className="num">{statement.ownerTotal > 0 ? eur(statement.ownerTotal) : "—"}</td><td className="num">{statement.tenantTotal > 0 ? eur(statement.tenantTotal) : "—"}</td></tr>
              </tbody>
            </table>
            {readings.length > 0 && (
              <table className="pt" style={{ marginTop: 6 }}>
                <thead><tr><th>Ενδείξεις θέρμανσης</th><th className="num">Προηγούμενη</th><th className="num">Τρέχουσα</th><th className="num">Κατανάλωση</th></tr></thead>
                <tbody>{readings.map((r, i) => <tr key={i}><td>Θερμιδομετρητής διαμ. {r.unitNumber}</td><td className="num">{num(r.previousReading, 3)}</td><td className="num">{num(r.currentReading, 3)}</td><td className="num" style={{ fontWeight: 700 }}>{num(r.consumption, 3)}</td></tr>)}</tbody>
              </table>
            )}
          </section>

          <div className="ppay">
            <div>
              <div className="lbl">Πληρωτέο ποσό διαμερίσματος {unit.unitNumber}</div>
              <div className="amt">{eur(statement.total)}</div>
              <div className="note">
                {statement.ownerTotal > 0 && <>Ιδιοκτήτης: <b>{eur(statement.ownerTotal)}</b></>}
                {statement.ownerTotal > 0 && statement.tenantTotal > 0 && " · "}
                {statement.tenantTotal > 0 && <>Ένοικος: <b>{eur(statement.tenantTotal)}</b></>}
              </div>
            </div>
            <div style={{ textAlign: "right", fontSize: "9pt", lineHeight: 1.5 }}>
              {settled ? <span className="pstamp">Εξοφλημένο</span> : <>
                <div>Προθεσμία εξόφλησης: <b>{dateLabel(dueDate)}</b></div>
                {brand.iban && <div>IBAN: <b style={{ fontVariantNumeric: "tabular-nums" }}>{brand.iban}</b></div>}
                <div style={{ color: "#555" }}>Αιτιολογία κατάθεσης: «Κοιν. {period.month} Διαμ. {unit.unitNumber}»</div>
              </>}
            </div>
          </div>
        </>
      )}
      <Signatures managerName={building.managerName} />
    </PrintSheet>
  );
}

function GroupRows({ g }: { g: UnitStatement["groups"][number] }) {
  return (
    <>
      <tr className="group"><td colSpan={3}>{g.label}</td></tr>
      {g.lines.map((l) => {
        const distinct = !!l.description && l.description.trim() !== "" && l.description !== l.categoryName;
        return (
          <tr key={l.id}>
            <td>{distinct ? <><div>{l.description}</div><div className="dim">{l.categoryName}</div></> : l.categoryName}</td>
            <td className="num">{eur(l.amount)}</td>
            <td className="num key">{eur(l.unitAmount)}</td>
          </tr>
        );
      })}
      <tr className="sub"><td>Σύνολο ομάδας</td><td className="num">{eur(g.buildingTotal)}</td><td className="num key">{eur(g.unitAmount)}</td></tr>
    </>
  );
}
