import { PrintSheet } from "@/components/print/PrintShell";
import type { PrintBrand } from "@/lib/print/brand";
import type { PrintBuilding } from "@/lib/print/data";
import { dateLabel, dateLong } from "@/lib/print/format";

export type AnnouncementInput = { title: string; html: string; date: Date; audience: string; sender: string | null };
type Props = { brand: PrintBrand; building: PrintBuilding; a: AnnouncementInput };
const AUD: Record<string, string> = { ALL: "Προς όλους τους ενοίκους και ιδιοκτήτες", OWNERS: "Προς τους ιδιοκτήτες", RESIDENTS: "Προς τους ενοίκους", CUSTOM: "Προς επιλεγμένους παραλήπτες" };

/** Ανακοίνωση για τον πίνακα ανακοινώσεων — large title, readable from a distance. */
export function AnnouncementDoc({ brand, building, a }: Props) {
  return (
    <PrintSheet
      brand={brand} building={building}
      eyebrow="Πίνακας ανακοινώσεων"
      title="Ανακοίνωση"
      subtitle={<>{AUD[a.audience] ?? a.audience} · {dateLong(a.date)}</>}
      docNo={`ΑΝ-${a.date.toISOString().slice(0, 10).replace(/-/g, "")}`}
      issuedAt={a.date}
      meta={[{ k: "Ημερομηνία", v: dateLabel(a.date) }, { k: "Απευθύνεται", v: AUD[a.audience] ?? a.audience }]}
    >
      <div style={{ marginTop: 10 }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: "30pt", lineHeight: 1.08, fontWeight: 600, letterSpacing: "-.01em", textWrap: "balance" }}>{a.title}</div>
        <div style={{ height: 3, width: 64, background: "#111", margin: "12px 0 16px" }} />
        <div className="pprose" style={{ fontSize: "12.5pt", lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: a.html }} />
      </div>
      <div style={{ marginTop: "auto" }}>
        <div className="psign">
          <div style={{ textAlign: "left", flex: "0 0 auto" }}>
            <div style={{ fontSize: "9pt", color: "#555" }}>Η Διαχείριση</div>
            <div style={{ fontWeight: 700, fontSize: "11pt" }}>{a.sender ?? building.managerName ?? brand.name}</div>
            <div style={{ fontSize: "9pt", color: "#555" }}>{[building.managerPhone ?? brand.phone, building.managerEmail ?? brand.email].filter(Boolean).join(" · ")}</div>
          </div>
        </div>
      </div>
    </PrintSheet>
  );
}
