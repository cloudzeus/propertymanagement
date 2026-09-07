import { PrintSheet } from "@/components/print/PrintShell";
import type { PrintBrand } from "@/lib/print/brand";
import type { PrintAssembly, PrintBuilding } from "@/lib/print/data";
import { dateLabel, dateLong, timeLabel } from "@/lib/print/format";
import { printableHtml } from "@/lib/print/html";

type Props = { brand: PrintBrand; building: PrintBuilding; assembly: PrintAssembly };
const STATUS: Record<string, string> = { SCHEDULED: "Προγραμματισμένη", LIVE: "Σε εξέλιξη", ENDED: "Ολοκληρώθηκε", TRANSCRIBING: "Απομαγνητοφώνηση", DRAFT_READY: "Πρόχειρα πρακτικά", APPROVED: "Εγκεκριμένα πρακτικά", SENT: "Πρακτικά απεσταλμένα", CANCELLED: "Ακυρώθηκε" };

/** Πρακτικά Γενικής Συνέλευσης — attendance + the approved minutes. */
export function MinutesDoc({ brand, building, assembly }: Props) {
  const html = assembly.minutesFinal ? printableHtml(assembly.minutesFinal) : null;
  const attended = assembly.participants.filter((p) => p.joinedAt || p.durationSeconds > 0);
  return (
    <PrintSheet
      brand={brand} building={building}
      eyebrow="Γενική Συνέλευση · Πρακτικά"
      title="Πρακτικά Γενικής Συνέλευσης"
      subtitle={<>{assembly.title} · {dateLong(assembly.scheduledAt)}, ώρα {timeLabel(assembly.scheduledAt)}</>}
      docNo={`ΠΡ-${assembly.scheduledAt.toISOString().slice(0, 10).replace(/-/g, "")}`}
      issuedAt={assembly.approvedAt ?? new Date()}
      meta={[{ k: "Συνέλευση", v: dateLabel(assembly.scheduledAt), s: timeLabel(assembly.scheduledAt) }, { k: "Κατάσταση", v: STATUS[assembly.status] ?? assembly.status, s: assembly.approvedAt ? `Εγκρίθηκαν ${dateLabel(assembly.approvedAt)}` : undefined }]}
    >
      <section className="psec">
        <div className="psec-title">Συμμετέχοντες ({assembly.participants.length})</div>
        <table className="pt">
          <thead><tr><th>Ονοματεπώνυμο</th><th>Διαμ.</th><th>Ιδιότητα</th><th>Παρουσία</th></tr></thead>
          <tbody>
            {assembly.participants.map((p, i) => (
              <tr key={i}><td>{p.displayName}</td><td>{p.unitNumber ?? "—"}</td><td>{p.isHost ? "Πρόεδρος / Διαχείριση" : "Συνιδιοκτήτης"}</td><td>{p.joinedAt || p.durationSeconds > 0 ? `Παρών${p.durationSeconds ? ` · ${Math.round(p.durationSeconds / 60)}′` : ""}` : "Προσκεκλημένος"}</td></tr>
            ))}
          </tbody>
        </table>
        {attended.length === 0 && <div className="dim" style={{ marginTop: 4, color: "#555", fontSize: "8.5pt" }}>Η παρουσία καταγράφεται αυτόματα για ηλεκτρονικές συνελεύσεις· για δια ζώσης συνελεύσεις συμπληρώνεται από τον γραμματέα.</div>}
      </section>
      <section className="psec" style={{ breakInside: "auto" }}>
        <div className="psec-title">Πρακτικά</div>
        {html ? <div className="pprose" dangerouslySetInnerHTML={{ __html: html }} /> : <div className="dim" style={{ color: "#555" }}>Δεν υπάρχουν εγκεκριμένα πρακτικά για αυτή τη συνέλευση.</div>}
      </section>
      <div className="psign">
        <div><div className="line">Ο/Η Πρόεδρος της Συνέλευσης</div></div>
        <div><div className="line">Ο/Η Γραμματέας</div></div>
        <div><div className="line">Ο/Η Διαχειριστής/τρια</div>{building.managerName && <div className="name">{building.managerName}</div>}</div>
      </div>
    </PrintSheet>
  );
}
