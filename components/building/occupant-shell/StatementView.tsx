"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RiPrinterLine } from "react-icons/ri";
import type { OccupantData } from "@/lib/building/occupant-data";
import { UnitStatementDocument } from "./UnitStatementDocument";

type Props = {
  building: OccupantData["building"];
  statements: OccupantData["statements"];
  months: OccupantData["months"];
  selectedMonth: string;
  managerName: OccupantData["managerName"];
  heatingReadings: OccupantData["heatingReadings"];
};

const monthLabel = (m: string) => {
  const d = new Date(`${m}-01T12:00:00`);
  const s = new Intl.DateTimeFormat("el-GR", { month: "long", year: "numeric" }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const UNIT_TYPE: Record<string, string> = {
  APARTMENT: "Διαμέρισμα", SHOP: "Κατάστημα", PARKING: "Θέση στάθμευσης", OTHER: "Χώρος",
};

const control: React.CSSProperties = {
  border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)",
  borderRadius: 6, padding: "7px 10px", fontSize: 13, fontWeight: 600, cursor: "pointer",
};

/**
 * Ειδοποιητήριο κοινοχρήστων — classic PER-APARTMENT notice. Owns the month/unit
 * selectors + print button and resolves the selected `UnitStatement`; the notice
 * body itself lives in `UnitStatementDocument` (shared with the payments table +
 * account modal). Print-ready A4 via the `.statement-print-root` (on the document)
 * / `.no-print` classes (see app/globals.css).
 */
export function StatementView({ building, statements, months, selectedMonth, managerName, heatingReadings }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  const unitParam = search.get("unit");
  const selected = statements.find((s) => s.unitId === unitParam) ?? statements[0];

  const setQuery = (patch: Record<string, string>) => {
    const q = new URLSearchParams(search.toString());
    q.set("s", "koino");
    for (const [k, v] of Object.entries(patch)) q.set(k, v);
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  };

  if (!selected) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* controls — screen only */}
      <div className="no-print" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label htmlFor="stmt-month" style={{ fontSize: 13, fontWeight: 600, color: "var(--muted-foreground)" }}>Μήνας</label>
            <select id="stmt-month" value={selectedMonth} onChange={(e) => setQuery({ month: e.target.value })} style={control}>
              {!months.includes(selectedMonth) && <option value={selectedMonth}>{monthLabel(selectedMonth)}</option>}
              {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
            </select>
          </div>
          {statements.length > 1 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <label htmlFor="stmt-unit" style={{ fontSize: 13, fontWeight: 600, color: "var(--muted-foreground)" }}>Διαμέρισμα</label>
              <select id="stmt-unit" value={selected.unitId} onChange={(e) => setQuery({ unit: e.target.value })} style={control}>
                {statements.map((s) => (
                  <option key={s.unitId} value={s.unitId}>
                    {(UNIT_TYPE[s.unitType] ?? s.unitType)} {s.unitNumber}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <button type="button" onClick={() => window.print()} style={{
          display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 6, padding: "8px 15px",
          border: "1px solid var(--border-strong)", background: "var(--card)", color: "var(--foreground)",
          fontSize: 13, fontWeight: 700, cursor: "pointer",
        }}>
          <RiPrinterLine style={{ fontSize: 16 }} /> Εκτύπωση
        </button>
      </div>

      <UnitStatementDocument
        building={building}
        statement={selected}
        month={selectedMonth}
        managerName={managerName}
        heatingReadings={heatingReadings}
        showPrintRoot
        emptyMessage={
          <>
            {months.length === 0
              ? "Δεν έχουν εκδοθεί ακόμη κοινόχρηστα για το κτήριο."
              : `Δεν υπάρχουν εκδοθέντα κοινόχρηστα για το διαμέρισμα ${selected.unitNumber} τον μήνα «${monthLabel(selectedMonth)}».`}
            {months.length > 0 && (
              <div style={{ marginTop: 6, fontSize: 12.5 }}>Επιλέξτε άλλον μήνα από την επιλογή «Μήνας» πάνω αριστερά.</div>
            )}
          </>
        }
      />
    </div>
  );
}
