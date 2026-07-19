"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RiPrinterLine, RiWallet3Line } from "react-icons/ri";
import type { OccupantData } from "@/lib/building/occupant-data";
import { StatusChip } from "@/components/dashboard";

type Props = {
  building: OccupantData["building"];
  myUnits: OccupantData["myUnits"];
  months: OccupantData["months"];
  selectedMonth: string;
  statement: OccupantData["statement"];
  paid: OccupantData["paid"];
  heatingReadings: OccupantData["heatingReadings"];
};

const eur = (n: number) => `${n.toLocaleString("el-GR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const num3 = (n: number | null) => (n == null ? "—" : n.toLocaleString("el-GR", { maximumFractionDigits: 3 }));
const mill = (n: number | null) => (n == null ? "—" : `${n.toLocaleString("el-GR", { maximumFractionDigits: 2 })}‰`);
const monthLabel = (m: string) => {
  const d = new Date(`${m}-01T12:00:00`);
  const s = new Intl.DateTimeFormat("el-GR", { month: "long", year: "numeric" }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** Soft highlight for the viewer's own money column. */
const myCol = "color-mix(in srgb, var(--color-primary) 8%, transparent)";

const th: React.CSSProperties = {
  padding: "7px 12px", fontSize: 11.5, fontWeight: 700, textAlign: "left",
  textTransform: "uppercase", letterSpacing: ".03em", color: "var(--muted-foreground)",
  borderBottom: "1px solid var(--border-strong)",
};
const td: React.CSSProperties = { padding: "8px 12px", fontSize: 13, color: "var(--foreground)", borderBottom: "1px solid var(--border)" };
const money: React.CSSProperties = { textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };
const totalRow: React.CSSProperties = { ...td, fontWeight: 800, borderBottom: "none", borderTop: "1px solid var(--border-strong)", background: "var(--bg-canvas)" };
const boxed: React.CSSProperties = { border: "1px solid var(--border-strong)", borderRadius: 10, overflow: "hidden", background: "var(--card)" };
const headCellLabel: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--muted-foreground)" };
const headCellValue: React.CSSProperties = { fontSize: 13.5, fontWeight: 700, color: "var(--foreground)", marginTop: 2 };

/**
 * Ειδοποιητήριο κοινοχρήστων — classic notice layout: groups Α-Ε with building
 * totals + the viewer's own share, footer with the payable amount, print-ready
 * via the `statement-print-root` / `no-print` classes (see app/globals.css).
 */
export function StatementView({ building, myUnits, months, selectedMonth, statement, paid, heatingReadings }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  const payable = Math.round((statement.myTenant + statement.myOwner) * 100) / 100;
  const hasHeatingGroup = statement.groups.some((g) => g.key === "C");

  const onMonth = (m: string) => {
    const q = new URLSearchParams(search.toString());
    q.set("s", "koino");
    q.set("month", m);
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  };

  return (
    <div className="statement-print-root" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* controls — screen only */}
      <div className="no-print" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label htmlFor="stmt-month" style={{ fontSize: 13, fontWeight: 600, color: "var(--muted-foreground)" }}>Μήνας</label>
          <select
            id="stmt-month"
            value={selectedMonth}
            onChange={(e) => onMonth(e.target.value)}
            style={{
              border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)",
              borderRadius: 6, padding: "7px 10px", fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}
          >
            {!months.includes(selectedMonth) && <option value={selectedMonth}>{monthLabel(selectedMonth)}</option>}
            {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 6, padding: "8px 15px",
            border: "1px solid var(--border-strong)", background: "var(--card)", color: "var(--foreground)",
            fontSize: 13, fontWeight: 700, cursor: "pointer",
          }}
        >
          <RiPrinterLine style={{ fontSize: 16 }} /> Εκτύπωση
        </button>
      </div>

      {/* notice header strip */}
      <div style={boxed}>
        <div style={{ padding: "10px 14px", textAlign: "center", fontSize: 15, fontWeight: 800, letterSpacing: ".06em", borderBottom: "1px solid var(--border-strong)", color: "var(--foreground)" }}>
          ΕΙΔΟΠΟΙΗΤΗΡΙΟ ΚΟΙΝΟΧΡΗΣΤΩΝ
        </div>
        <div style={{ display: "flex", flexWrap: "wrap" }}>
          <div style={{ flex: "2 1 240px", padding: "10px 14px", borderRight: "1px solid var(--border)" }}>
            <div style={headCellLabel}>Πολυκατοικία</div>
            <div style={headCellValue}>{building.name}</div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 1 }}>
              {[building.address, building.city].filter(Boolean).join(", ") || "—"}
            </div>
          </div>
          <div style={{ flex: "1 1 150px", padding: "10px 14px", borderRight: "1px solid var(--border)" }}>
            <div style={headCellLabel}>Μήνας</div>
            <div style={headCellValue}>{monthLabel(selectedMonth)}</div>
          </div>
          <div style={{ flex: "1 1 170px", padding: "10px 14px" }}>
            <div style={headCellLabel}>Η μονάδα μου</div>
            <div style={headCellValue}>{myUnits.map((u) => u.unitNumber).join(", ")}</div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 1 }}>
              {[...new Set(myUnits.map((u) => u.rel))].join(" · ")}
            </div>
          </div>
        </div>
      </div>

      {statement.groups.length === 0 ? (
        <div style={{ border: "1px dashed var(--border-strong)", borderRadius: 10, padding: "36px 20px", textAlign: "center", color: "var(--muted-foreground)", fontSize: 13, background: "var(--card)" }}>
          <RiWallet3Line style={{ fontSize: 30, opacity: 0.35, display: "block", margin: "0 auto 8px" }} />
          {months.length === 0
            ? "Δεν έχουν εκδοθεί ακόμη κοινόχρηστα για το κτήριο."
            : `Δεν υπάρχουν εκδοθέντα κοινόχρηστα για τον μήνα «${monthLabel(selectedMonth)}».`}
          {months.length > 0 && (
            <div style={{ marginTop: 6, fontSize: 12.5 }}>Επιλέξτε άλλον μήνα από την επιλογή «Μήνας» πάνω αριστερά.</div>
          )}
        </div>
      ) : (
        <>
          {/* groups Α-Ε */}
          {statement.groups.map((g) => (
            <div key={g.key} style={boxed}>
              <div style={{ padding: "9px 12px", fontSize: 12.5, fontWeight: 800, letterSpacing: ".04em", background: "var(--bg-canvas)", borderBottom: "1px solid var(--border-strong)", color: "var(--foreground)" }}>
                {g.label}
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={th}>Κατηγορία δαπάνης</th>
                      <th style={{ ...th, ...money, width: 150 }}>Δαπάνη κτηρίου</th>
                      <th style={{ ...th, ...money, width: 150, background: myCol }}>Η αναλογία μου</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.lines.map((l) => (
                      <tr key={l.id}>
                        <td style={td}>{l.categoryName}</td>
                        <td style={{ ...td, ...money }}>{eur(l.amount)}</td>
                        <td style={{ ...td, ...money, background: myCol, fontWeight: 600 }}>{eur(l.myShare)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td style={totalRow}>Σύνολο ομάδας</td>
                      <td style={{ ...totalRow, ...money }}>{eur(g.total)}</td>
                      <td style={{ ...totalRow, ...money, background: myCol }}>{eur(g.myTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {g.key === "C" && heatingReadings.length > 0 && <HeatingReadings rows={heatingReadings} />}
            </div>
          ))}

          {/* metered heating readings even when no Γ group was issued this month */}
          {!hasHeatingGroup && heatingReadings.length > 0 && (
            <div style={boxed}>
              <HeatingReadings rows={heatingReadings} standalone />
            </div>
          )}

          {/* footer summary */}
          <div style={boxed}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 14px", borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: ".04em", color: "var(--foreground)" }}>ΣΥΝΟΛΟ ΔΑΠΑΝΩΝ ΚΤΗΡΙΟΥ</span>
              <span style={{ ...money, fontSize: 14, fontWeight: 800, color: "var(--foreground)" }}>{eur(statement.total)}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 14px", borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontSize: 12.5, color: "var(--muted-foreground)" }}>
                Αναλογούν μονάδας (σύνολο μεριδίων {myUnits.length > 1 ? "των μονάδων μου" : "της μονάδας μου"})
              </span>
              <span style={{ ...money, fontSize: 13.5, fontWeight: 700, color: "var(--foreground)" }}>{eur(statement.myTotal)}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "13px 14px", background: myCol, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: ".05em", color: "var(--muted-foreground)" }}>ΠΛΗΡΩΤΕΟ ΠΟΣΟ</div>
                <div style={{ fontSize: 30, fontWeight: 800, fontVariantNumeric: "tabular-nums", color: "var(--foreground)", lineHeight: 1.15 }}>{eur(payable)}</div>
                {(statement.myTenant > 0 || statement.myOwner > 0) && (
                  <div style={{ fontSize: 12.5, color: "var(--muted-foreground)", display: "flex", gap: 14, marginTop: 3, flexWrap: "wrap" }}>
                    {statement.myTenant > 0 && (
                      <span>Μερίδιο ενοίκου: <b style={{ color: "var(--foreground)", fontVariantNumeric: "tabular-nums" }}>{eur(statement.myTenant)}</b></span>
                    )}
                    {statement.myOwner > 0 && (
                      <span>Μερίδιο ιδιοκτήτη: <b style={{ color: "var(--foreground)", fontVariantNumeric: "tabular-nums" }}>{eur(statement.myOwner)}</b></span>
                    )}
                  </div>
                )}
              </div>
              <StatusChip tone={paid.settled ? "success" : "warning"}>
                {paid.settled ? "Εξοφλημένο" : "Εκκρεμεί"}
              </StatusChip>
            </div>
            <div style={{ padding: "9px 14px", borderTop: "1px solid var(--border)", fontSize: 12, color: "var(--muted-foreground)", display: "flex", flexDirection: "column", gap: 3 }}>
              {myUnits.map((u) => (
                <div key={u.id}>
                  Μονάδα {u.unitNumber} — Χιλιοστά: Κανονικά {mill(u.millesimes)} · Ανελκυστήρα {mill(u.millesimesElevator)} · Θέρμανσης {mill(u.millesimesHeating)}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function HeatingReadings({ rows, standalone = false }: { rows: OccupantData["heatingReadings"]; standalone?: boolean }) {
  return (
    <div style={{ borderTop: standalone ? "none" : "1px dashed var(--border-strong)", padding: "10px 12px", background: "var(--bg-canvas)" }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".03em", color: "var(--muted-foreground)", marginBottom: 6 }}>
        Ενδείξεις θέρμανσης μονάδας
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>Μονάδα</th>
              <th style={{ ...th, ...money }}>Προηγούμενη ένδειξη</th>
              <th style={{ ...th, ...money }}>Τρέχουσα ένδειξη</th>
              <th style={{ ...th, ...money }}>Κατανάλωση</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.unitId}>
                <td style={td}>{r.unitNumber}</td>
                <td style={{ ...td, ...money }}>{num3(r.previousReading)}</td>
                <td style={{ ...td, ...money }}>{num3(r.currentReading)}</td>
                <td style={{ ...td, ...money, fontWeight: 700 }}>{num3(r.consumption)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
