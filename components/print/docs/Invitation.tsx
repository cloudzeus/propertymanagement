import { PrintSheet, Signatures } from "@/components/print/PrintShell";
import type { PrintBrand } from "@/lib/print/brand";
import type { PrintBuilding } from "@/lib/print/data";
import { dateLabel, dateLong, timeLabel } from "@/lib/print/format";

export type InvitationInput = { kind: "Τακτική" | "Έκτακτη"; title: string | null; at: Date; place: string; agenda: string[]; repeatAt: Date | null; online: boolean };
type Props = { brand: PrintBrand; building: PrintBuilding; inv: InvitationInput };

/** Πρόσκληση σε Γενική Συνέλευση συνιδιοκτητών — with agenda and a proxy (εξουσιοδότηση) slip. */
export function InvitationDoc({ brand, building, inv }: Props) {
  return (
    <PrintSheet
      brand={brand} building={building}
      eyebrow={`Γενική Συνέλευση · ${inv.kind}`}
      title="Πρόσκληση σε Γενική Συνέλευση"
      subtitle={<>{dateLong(inv.at)}, ώρα <b>{timeLabel(inv.at)}</b> · {inv.place}</>}
      docNo={`ΠΣ-${inv.at.toISOString().slice(0, 10).replace(/-/g, "")}`}
      meta={[{ k: "Ημερομηνία & ώρα", v: `${dateLabel(inv.at)} · ${timeLabel(inv.at)}` }, { k: "Τόπος", v: inv.place }]}
    >
      <div className="pprose" style={{ fontSize: "10pt" }}>
        <p><b>Προς τους συνιδιοκτήτες και ενοίκους της πολυκατοικίας «{building.name}», {building.address}, {building.city}.</b></p>
        <p>
          Σύμφωνα με τον Κανονισμό της πολυκατοικίας και τις διατάξεις του Ν. 3741/1929, σας προσκαλούμε στην <b>{inv.kind} Γενική Συνέλευση</b>
          {inv.title ? <> με θέμα «{inv.title}»</> : null}, που θα πραγματοποιηθεί την <b>{dateLong(inv.at)}</b> και ώρα <b>{timeLabel(inv.at)}</b>,
          {inv.online ? <> <b>ηλεκτρονικά μέσω της εφαρμογής</b> (ο σύνδεσμος συμμετοχής αποστέλλεται με email πριν την έναρξη)</> : <> στ{/[αάη]$/.test(inv.place) ? "ην " : "ο "}<b>{inv.place}</b></>},
          με τα ακόλουθα θέματα ημερήσιας διάταξης:
        </p>
      </div>
      <section className="psec">
        <div className="psec-title">Θέματα ημερήσιας διάταξης</div>
        <ol className="pagenda">{inv.agenda.map((a, i) => <li key={i}><span>{a}</span></li>)}</ol>
      </section>
      <div className="pprose" style={{ fontSize: "10pt" }}>
        {inv.repeatAt && <p>Σε περίπτωση έλλειψης απαρτίας, η Συνέλευση θα επαναληφθεί την <b>{dateLong(inv.repeatAt)}</b>, ώρα <b>{timeLabel(inv.repeatAt)}</b>, στον ίδιο τόπο και με τα ίδια θέματα, οπότε οι αποφάσεις θα ληφθούν από τους παρόντες σύμφωνα με τον Κανονισμό.</p>}
        <p>Η παρουσία όλων είναι απαραίτητη. Όσοι αδυνατούν να παραστούν μπορούν να εκπροσωπηθούν με την παρακάτω εξουσιοδότηση. Για διευκρινίσεις επικοινωνήστε με τη διαχείριση{building.managerPhone ? <> στο <b>{building.managerPhone}</b></> : null}{building.managerEmail ? <> ή στο <b>{building.managerEmail}</b></> : null}.</p>
      </div>
      <Signatures managerName={building.managerName} />
      <div className="pcut">
        <div className="pdoc-eyebrow" style={{ marginBottom: 6 }}>Εξουσιοδότηση εκπροσώπησης</div>
        <div className="pprose" style={{ fontSize: "9.5pt", lineHeight: 2 }}>
          Ο/Η υπογράφων/ουσα ____________________________________, ιδιοκτήτης/τρια του διαμερίσματος ______ της πολυκατοικίας «{building.name}»,
          εξουσιοδοτώ τον/την ____________________________________ να με εκπροσωπήσει και να ψηφίσει για λογαριασμό μου στη Γενική Συνέλευση της {dateLabel(inv.at)}
          {inv.repeatAt ? ` (ή στην επαναληπτική της ${dateLabel(inv.repeatAt)})` : ""} για όλα τα θέματα της ημερήσιας διάταξης.
        </div>
        <div className="psign" style={{ marginTop: 4 }}>
          <div><div className="line">Ημερομηνία</div></div>
          <div><div className="line">Υπογραφή εξουσιοδοτούντος</div></div>
        </div>
      </div>
    </PrintSheet>
  );
}
