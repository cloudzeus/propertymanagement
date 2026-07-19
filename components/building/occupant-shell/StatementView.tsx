"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RiArrowDownSLine, RiArrowRightSLine, RiPrinterLine, RiWallet3Line } from "react-icons/ri";
import type { OccupantData } from "@/lib/building/occupant-data";
import { StatusChip } from "@/components/dashboard";
import { PrintArea } from "@/components/ui/print-area";
import { UnitStatementDocument } from "./UnitStatementDocument";

type Props = {
  building: OccupantData["building"];
  statementsByUnit: OccupantData["statementsByUnit"];
  managerName: OccupantData["managerName"];
};

type UnitBlock = OccupantData["statementsByUnit"][number];

const eur = (n: number) => `${n.toLocaleString("el-GR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const monthLabel = (m: string) => {
  const d = new Date(`${m}-01T12:00:00`);
  const s = new Intl.DateTimeFormat("el-GR", { month: "long", year: "numeric" }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const floorLabel = (f: number | null) => (f == null ? null : f === 0 ? "Ισόγειο" : f < 0 ? "Υπόγειο" : `${f}ος όροφος`);

const UNIT_TYPE: Record<string, string> = {
  APARTMENT: "Διαμέρισμα", SHOP: "Κατάστημα", PARKING: "Θέση στάθμευσης", OTHER: "Χώρος",
};

const control: React.CSSProperties = {
  border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)",
  borderRadius: 6, padding: "7px 10px", fontSize: 13, fontWeight: 600, cursor: "pointer",
};

/**
 * Ειδοποιητήριο κοινοχρήστων — per-apartment notices, now one expandable row per
 * ISSUED MONTH (mirrors ExpensesSection). Keeps only the «Διαμέρισμα» selector;
 * every month for the chosen unit is a summary row (μήνας + «Το μερίδιό μου» +
 * status chip) that expands to the full `UnitStatementDocument` with a per-month
 * print button. Printing renders the active month into a body-level `<PrintArea>`
 * (see components/ui/print-area.tsx + `.print-area`/`.no-print` in app/globals.css).
 */
export function StatementView({ building, statementsByUnit, managerName }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  const unitParam = search.get("unit");
  const selected = statementsByUnit.find((u) => u.unitId === unitParam) ?? statementsByUnit[0];

  const setUnit = (unitId: string) => {
    const q = new URLSearchParams(search.toString());
    q.set("s", "koino");
    q.set("unit", unitId);
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  };

  if (!selected) return null;

  const unitLine = [UNIT_TYPE[selected.unitType] ?? selected.unitType, floorLabel(selected.floor)].filter(Boolean).join(" · ");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* controls — screen only */}
      <div className="no-print" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "var(--foreground)" }}>
            {UNIT_TYPE[selected.unitType] ?? selected.unitType} {selected.unitNumber}
          </div>
          {unitLine && <div style={{ fontSize: 12.5, color: "var(--muted-foreground)" }}>{unitLine}</div>}
        </div>
        {statementsByUnit.length > 1 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label htmlFor="stmt-unit" style={{ fontSize: 13, fontWeight: 600, color: "var(--muted-foreground)" }}>Διαμέρισμα</label>
            <select id="stmt-unit" value={selected.unitId} onChange={(e) => setUnit(e.target.value)} style={control}>
              {statementsByUnit.map((u) => (
                <option key={u.unitId} value={u.unitId}>
                  {(UNIT_TYPE[u.unitType] ?? u.unitType)} {u.unitNumber}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Re-key on unit so open/print state resets when the apartment changes. */}
      <UnitStatements key={selected.unitId} unit={selected} building={building} managerName={managerName} />
    </div>
  );
}

/** The month-by-month notice list for ONE unit (self-contained open + print state). */
function UnitStatements({ unit, building, managerName }: {
  unit: UnitBlock;
  building: OccupantData["building"];
  managerName: OccupantData["managerName"];
}) {
  // First (latest) month open by default.
  const [open, setOpen] = useState<Set<string>>(() => new Set(unit.months.slice(0, 1).map((m) => m.month)));
  // The month currently staged for print (defaults to the latest so Ctrl+P works too).
  const [printMonth, setPrintMonth] = useState<string | null>(unit.months[0]?.month ?? null);
  const [printNonce, setPrintNonce] = useState(0);

  useEffect(() => {
    if (printNonce === 0) return;
    const id = window.requestAnimationFrame(() => window.print());
    return () => window.cancelAnimationFrame(id);
  }, [printNonce]);

  const printDoc = printMonth ? unit.months.find((m) => m.month === printMonth) : null;

  if (unit.months.length === 0) {
    return (
      <div style={{ border: "1px dashed var(--border-strong)", borderRadius: 10, padding: "36px 20px", textAlign: "center", color: "var(--muted-foreground)", fontSize: 13, background: "var(--card)" }}>
        <RiWallet3Line style={{ fontSize: 30, opacity: 0.35, display: "block", margin: "0 auto 8px" }} />
        Δεν έχουν εκδοθεί κοινόχρηστα για το διαμέρισμα.
      </div>
    );
  }

  const toggle = (m: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m); else next.add(m);
      return next;
    });

  const doPrint = (month: string) => {
    setPrintMonth(month);
    setPrintNonce((n) => n + 1);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {unit.months.map((m) => {
        const isOpen = open.has(m.month);
        return (
          <div key={m.month} style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
            <button
              type="button"
              onClick={() => toggle(m.month)}
              aria-expanded={isOpen}
              style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%", minHeight: 48,
                padding: "12px 14px", border: "none", cursor: "pointer", textAlign: "left",
                background: isOpen ? "var(--bg-canvas)" : "var(--card)", color: "var(--foreground)",
              }}
            >
              {isOpen
                ? <RiArrowDownSLine style={{ fontSize: 18, color: "var(--muted-foreground)", flexShrink: 0 }} />
                : <RiArrowRightSLine style={{ fontSize: 18, color: "var(--muted-foreground)", flexShrink: 0 }} />}
              <span style={{ fontSize: 14, fontWeight: 700 }}>{monthLabel(m.month)}</span>
              <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 12, flexWrap: "wrap", justifyContent: "flex-end" }}>
                <span style={{ fontSize: 12.5, color: "var(--muted-foreground)" }}>
                  Το μερίδιό μου:{" "}
                  <b style={{ fontSize: 15, fontWeight: 800, color: "var(--color-primary)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                    {eur(m.myPayable)}
                  </b>
                </span>
                <StatusChip tone={m.settled ? "success" : "warning"}>{m.settled ? "Εξοφλημένο" : "Εκκρεμεί"}</StatusChip>
              </span>
            </button>

            {isOpen && (
              <div style={{ borderTop: "1px solid var(--border)", padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
                <UnitStatementDocument
                  building={building}
                  statement={m.statement}
                  month={m.month}
                  managerName={managerName}
                  heatingReadings={m.heatingReadings}
                />
                <div className="no-print" style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button type="button" onClick={() => doPrint(m.month)} style={{
                    display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 6, padding: "8px 15px",
                    border: "1px solid var(--border-strong)", background: "var(--card)", color: "var(--foreground)",
                    fontSize: 13, fontWeight: 700, cursor: "pointer",
                  }}>
                    <RiPrinterLine style={{ fontSize: 16 }} /> Εκτύπωση
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Print target: the staged month rendered body-level, shown only in print. */}
      {printDoc && (
        <PrintArea>
          <UnitStatementDocument
            building={building}
            statement={printDoc.statement}
            month={printDoc.month}
            managerName={managerName}
            heatingReadings={printDoc.heatingReadings}
          />
        </PrintArea>
      )}
    </div>
  );
}
