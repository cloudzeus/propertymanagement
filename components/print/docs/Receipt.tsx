import { PrintSheet } from "@/components/print/PrintShell";
import type { PrintBrand } from "@/lib/print/brand";
import type { Period, PrintBuilding, PrintUnit } from "@/lib/print/data";
import { eur, monthLabel, dateLabel, methodLabel, amountInWordsEl } from "@/lib/print/format";

type Party = "owner" | "tenant";
type Props = { brand: PrintBrand; building: PrintBuilding; period: Period; unit: PrintUnit; party: Party };

/** Απόδειξη είσπραξης κοινοχρήστων — original + stub (στέλεχος) on one sheet. */
export function ReceiptDoc({ brand, building, period, unit, party }: Props) {
  const lines = period.expenses.flatMap((e) => {
    const a = e.allocations.find((x) => x.unitId === unit.id);
    if (!a) return [];
    const amount = party === "owner" ? a.ownerAmount : a.tenantAmount;
    const paid = party === "owner" ? a.ownerPaid : a.tenantPaid;
    if (amount <= 0) return [];
    return [{ id: e.id, label: e.description && e.description !== e.categoryName ? `${e.description} (${e.categoryName})` : e.categoryName, amount, paid, paidAt: party === "owner" ? a.ownerPaidAt : a.tenantPaidAt, method: party === "owner" ? a.ownerMethod : a.tenantMethod }];
  });
  const paidLines = lines.filter((l) => l.paid);
  const total = paidLines.reduce((a, l) => a + l.amount, 0);
  const due = lines.filter((l) => !l.paid).reduce((a, l) => a + l.amount, 0);
  const paidAt = paidLines.map((l) => l.paidAt).filter((d): d is Date => !!d).sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
  const methods = [...new Set(paidLines.map((l) => methodLabel(l.method)))].join(", ") || "—";
  const payer = party === "owner" ? unit.ownerName : unit.residentName;
  const payerRole = party === "owner" ? "Ιδιοκτήτης" : "Ένοικος";
  const docNo = `ΑΠ-${period.month.replace("-", "")}-${unit.unitNumber}-${party === "owner" ? "Ι" : "Ε"}`;

  return (
    <PrintSheet
      brand={brand} building={building}
      eyebrow="Κοινόχρηστα · Είσπραξη"
      title="Απόδειξη είσπραξης"
      subtitle={<>Περίοδος <b>{monthLabel(period.month)}</b> · Διαμέρισμα <b>{unit.unitNumber}</b> · {payerRole}</>}
      docNo={docNo} issuedAt={paidAt ?? new Date()}
      meta={[{ k: "Περίοδος", v: monthLabel(period.month) }, { k: "Ποσό", v: eur(total), s: methods }]}
      footNote="Η παρούσα απόδειξη αφορά είσπραξη κοινοχρήστων και δεν αποτελεί φορολογικό παραστατικό."
    >
      <ReceiptBody copy="Πρωτότυπο" docNo={docNo} paidAt={paidAt} payer={payer} payerRole={payerRole} unitNumber={unit.unitNumber} total={total} due={due} methods={methods} month={period.month} building={building} paidLines={paidLines} />
      <div className="pcut" />
      <ReceiptBody copy="Στέλεχος διαχείρισης" stub docNo={docNo} paidAt={paidAt} payer={payer} payerRole={payerRole} unitNumber={unit.unitNumber} total={total} due={due} methods={methods} month={period.month} building={building} paidLines={paidLines} />
    </PrintSheet>
  );
}

type BodyProps = { copy: string; stub?: boolean; docNo: string; paidAt: Date | null; payer: string | null; payerRole: string; unitNumber: string; total: number; due: number; methods: string; month: string; building: PrintBuilding; paidLines: { id: string; label: string; amount: number; paidAt: Date | null }[] };
function ReceiptBody({ copy, stub, docNo, paidAt, payer, payerRole, unitNumber, total, due, methods, month, building, paidLines }: BodyProps) {
  return (
    <div className="pbox compact" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span className="pstamp">{copy}</span>
        <span style={{ fontSize: "9pt", color: "#555" }}>Αρ. {docNo} · {dateLabel(paidAt ?? new Date())}</span>
      </div>
      <div className="pkv">
        <span className="k">Εισπράξαμε από</span><span><b>{payer ?? "—"}</b> · {payerRole} διαμερίσματος {unitNumber}</span>
        <span className="k">Ποσό</span><span><b style={{ fontSize: "14pt", fontVariantNumeric: "tabular-nums" }}>{eur(total)}</b></span>
        <span className="k">Ολογράφως</span><span>{(() => { const w = amountInWordsEl(total); return w.charAt(0).toUpperCase() + w.slice(1); })()}</span>
        <span className="k">Αιτιολογία</span><span>Κοινόχρηστα περιόδου {monthLabel(month)} — Πολυκατοικία «{building.name}», {building.address}</span>
        <span className="k">Τρόπος πληρωμής</span><span>{methods}</span>
      </div>
      {paidLines.length > 0 && !stub && (
        <table className="pt" style={{ fontSize: "8.5pt" }}>
          <thead><tr><th>Ανάλυση</th><th className="num">Ημ/νία</th><th className="num">Ποσό</th></tr></thead>
          <tbody>
            {paidLines.map((l) => <tr key={l.id}><td>{l.label}</td><td className="num">{dateLabel(l.paidAt)}</td><td className="num">{eur(l.amount)}</td></tr>)}
            <tr className="total"><td colSpan={2}>Σύνολο είσπραξης</td><td className="num">{eur(total)}</td></tr>
          </tbody>
        </table>
      )}
      {paidLines.length === 0 && <div style={{ color: "#a33", fontWeight: 700 }}>Δεν έχει καταχωρηθεί είσπραξη για τη συγκεκριμένη περίοδο — η απόδειξη δεν είναι έγκυρη χωρίς πληρωμή.</div>}
      {due > 0 && <div style={{ fontSize: "9pt", color: "#555" }}>Υπόλοιπο περιόδου που εκκρεμεί για τον/την {payerRole.toLowerCase()}: <b>{eur(due)}</b></div>}
      <div className="psign" style={{ marginTop: 0 }}>
        <div><div className="line">Ο εισπράξας (Διαχειριστής)</div>{building.managerName && <div className="name">{building.managerName}</div>}</div>
        <div><div className="line">Ο καταβάλλων</div><div className="name">{payer ?? ""}</div></div>
      </div>
    </div>
  );
}
