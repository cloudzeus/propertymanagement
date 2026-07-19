import type { ReactNode } from "react";
import { RiWallet3Line } from "react-icons/ri";
import type { UnitStatement } from "@/lib/building/statement";
import type { OccupantData } from "@/lib/building/occupant-data";
import { StatusChip } from "@/components/dashboard";

/** UnitStatement carrying the per-side paid flags used by the settled badge. */
export type StatementWithPaid = UnitStatement & { tenantPaid?: boolean | null; ownerPaid?: boolean | null };

type Props = {
  building: { name: string; address?: string | null; city?: string | null };
  statement: StatementWithPaid;
  month: string;
  managerName?: string | null;
  heatingReadings?: OccupantData["heatingReadings"];
  /** Message shown when the statement has no issued expenses (groups empty). */
  emptyMessage?: ReactNode;
};

const eur = (n: number) => `${n.toLocaleString("el-GR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const num3 = (n: number | null) => (n == null ? "—" : n.toLocaleString("el-GR", { maximumFractionDigits: 3 }));
const mill = (n: number | null) => (n == null ? "—" : `${n.toLocaleString("el-GR", { maximumFractionDigits: 2 })}‰`);
const monthLabel = (m: string) => {
  const d = new Date(`${m}-01T12:00:00`);
  const s = new Intl.DateTimeFormat("el-GR", { month: "long", year: "numeric" }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const floorLabel = (f: number | null) => (f == null ? null : f === 0 ? "Ισόγειο" : f < 0 ? "Υπόγειο" : `${f}ος όροφος`);

const UNIT_TYPE: Record<string, string> = {
  APARTMENT: "Διαμέρισμα", SHOP: "Κατάστημα", PARKING: "Θέση στάθμευσης", OTHER: "Χώρος",
};
const ROLE_LABEL: Record<StatementWithPaid["role"], string> = {
  OWNER: "Ιδιοκτήτης", RESIDENT: "Ένοικος", BOTH: "Ιδιοκατοίκηση",
};
const PAYABLE_CAPTION: Record<StatementWithPaid["role"], string> = {
  OWNER: "ως ιδιοκτήτης", RESIDENT: "ως ένοικος", BOTH: "ιδιοκτήτης + ένοικος",
};

const th: React.CSSProperties = {
  padding: "7px 12px", fontSize: 11.5, fontWeight: 700, textAlign: "left",
  textTransform: "uppercase", letterSpacing: ".03em", color: "var(--muted-foreground)",
  borderBottom: "1px solid var(--border-strong)",
};
const td: React.CSSProperties = { padding: "8px 12px", fontSize: 13, color: "var(--foreground)", borderBottom: "1px solid var(--border)" };
const money: React.CSSProperties = { textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };
const groupRow: React.CSSProperties = {
  padding: "8px 12px", fontSize: 12, fontWeight: 800, letterSpacing: ".04em",
  textTransform: "uppercase", background: "var(--bg-canvas)", color: "var(--foreground)",
  borderBottom: "1px solid var(--border-strong)", borderTop: "1px solid var(--border-strong)",
};
const subtotalRow: React.CSSProperties = { ...td, fontWeight: 800, background: "var(--bg-canvas)" };
const grandRow: React.CSSProperties = { ...td, fontWeight: 800, borderBottom: "none", borderTop: "2px solid var(--border-strong)", background: "var(--bg-canvas)" };
const boxed: React.CSSProperties = { border: "1px solid var(--border-strong)", borderRadius: 10, overflow: "hidden", background: "var(--card)" };
const sectionTitle: React.CSSProperties = {
  padding: "9px 12px", fontSize: 12.5, fontWeight: 800, letterSpacing: ".05em",
  background: "var(--bg-canvas)", borderBottom: "1px solid var(--border-strong)", color: "var(--foreground)",
};
const headCellLabel: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--muted-foreground)" };
const headCellValue: React.CSSProperties = { fontSize: 13.5, fontWeight: 700, color: "var(--foreground)", marginTop: 2 };

/**
 * The BODY of the classic per-apartment ειδοποιητήριο κοινοχρήστων, keyed off a
 * single resolved `UnitStatement`. Renders the notice header strip, ΑΝΑΛΥΣΗ
 * ΔΑΠΑΝΩΝ ΚΤΗΡΙΟΥ (building cost by group), ΑΝΑΛΟΓΙΑ ΔΙΑΜΕΡΙΣΜΑΤΟΣ (this unit's
 * χιλιοστά · ποσό αναλογίας · owner/tenant split), totals and the ΠΛΗΡΩΤΕΟ footer.
 *
 * Extracted from StatementView so it can also render inline in the payments
 * DataTable expand row and inside the «Προβολή λογαριασμού» print modal. The
 * month/unit selectors + print button stay in StatementView. Printing goes
 * through the body-level `<PrintArea>` (`.print-area` in app/globals.css).
 */
export function UnitStatementDocument({
  building, statement, month, managerName, heatingReadings, emptyMessage,
}: Props) {
  const roleLabel = ROLE_LABEL[statement.role];
  const settled =
    statement.role === "OWNER" ? statement.ownerPaid === true
    : statement.role === "RESIDENT" ? statement.tenantPaid === true
    : statement.tenantPaid !== false && statement.ownerPaid !== false; // BOTH
  const unitReadings = (heatingReadings ?? []).filter((r) => r.unitId === statement.unitId);
  const unitLine = [UNIT_TYPE[statement.unitType] ?? statement.unitType, floorLabel(statement.floor)].filter(Boolean).join(" · ");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* notice header strip */}
      <div style={boxed} data-boxed>
        <div style={{ padding: "10px 14px", textAlign: "center", fontSize: 15, fontWeight: 800, letterSpacing: ".06em", borderBottom: "1px solid var(--border-strong)", color: "var(--foreground)" }}>
          ΕΙΔΟΠΟΙΗΤΗΡΙΟ ΚΟΙΝΟΧΡΗΣΤΩΝ
        </div>
        <div style={{ display: "flex", flexWrap: "wrap" }}>
          <div style={{ flex: "2 1 220px", padding: "10px 14px", borderRight: "1px solid var(--border)" }}>
            <div style={headCellLabel}>Πολυκατοικία</div>
            <div style={headCellValue}>{building.name}</div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 1 }}>
              {[building.address, building.city].filter(Boolean).join(", ") || "—"}
            </div>
          </div>
          <div style={{ flex: "1 1 130px", padding: "10px 14px", borderRight: "1px solid var(--border)" }}>
            <div style={headCellLabel}>Μήνας</div>
            <div style={headCellValue}>{monthLabel(month)}</div>
          </div>
          <div style={{ flex: "1 1 180px", padding: "10px 14px", borderRight: "1px solid var(--border)" }}>
            <div style={headCellLabel}>Διαμέρισμα</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
              <span style={{ ...headCellValue, marginTop: 0 }}>{statement.unitNumber}</span>
              <StatusChip tone={statement.role === "RESIDENT" ? "info" : "accent"}>{roleLabel}</StatusChip>
            </div>
            {unitLine && <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 1 }}>{unitLine}</div>}
          </div>
          <div style={{ flex: "1 1 170px", padding: "10px 14px" }}>
            <div style={headCellLabel}>Χιλιοστά</div>
            <div style={{ fontSize: 12, color: "var(--foreground)", marginTop: 3, lineHeight: 1.7 }}>
              <div>Κανον.: <b style={{ fontVariantNumeric: "tabular-nums" }}>{mill(statement.millesimes)}</b></div>
              <div>Ανελκ.: <b style={{ fontVariantNumeric: "tabular-nums" }}>{mill(statement.millesimesElevator)}</b></div>
              <div>Θέρμ.: <b style={{ fontVariantNumeric: "tabular-nums" }}>{mill(statement.millesimesHeating)}</b></div>
            </div>
          </div>
        </div>
      </div>

      {statement.groups.length === 0 ? (
        <div style={{ border: "1px dashed var(--border-strong)", borderRadius: 10, padding: "36px 20px", textAlign: "center", color: "var(--muted-foreground)", fontSize: 13, background: "var(--card)" }}>
          <RiWallet3Line style={{ fontSize: 30, opacity: 0.35, display: "block", margin: "0 auto 8px" }} />
          {emptyMessage ?? `Δεν υπάρχουν εκδοθέντα κοινόχρηστα για το διαμέρισμα ${statement.unitNumber} τον μήνα «${monthLabel(month)}».`}
        </div>
      ) : (
        <>
          {/* ── ΑΝΑΛΥΣΗ ΔΑΠΑΝΩΝ: building expenses by group ───────────────── */}
          <div style={boxed} data-boxed>
            <div style={sectionTitle}>ΑΝΑΛΥΣΗ ΔΑΠΑΝΩΝ ΚΤΗΡΙΟΥ</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={th}>Κατηγορία δαπάνης</th>
                    <th style={{ ...th, ...money, width: 170 }}>Δαπάνη κτηρίου</th>
                  </tr>
                </thead>
                <tbody>
                  {statement.groups.map((g) => (
                    <GroupExpenseRows key={g.key} group={g} />
                  ))}
                  <tr>
                    <td style={grandRow}>ΣΥΝΟΛΟ ΔΑΠΑΝΩΝ ΚΤΗΡΙΟΥ</td>
                    <td style={{ ...grandRow, ...money }}>{eur(statement.groups.reduce((a, g) => a + g.buildingTotal, 0))}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ── ΑΝΑΛΟΓΙΑ ΔΙΑΜΕΡΙΣΜΑΤΟΣ: χιλιοστά + amount + owner/tenant split ─ */}
          <div style={boxed} data-boxed>
            <div style={sectionTitle}>ΑΝΑΛΟΓΙΑ ΔΙΑΜΕΡΙΣΜΑΤΟΣ {statement.unitNumber}</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={th}>Ομάδα δαπανών</th>
                    <th style={{ ...th, ...money, width: 110 }}>Χιλιοστά</th>
                    <th style={{ ...th, ...money, width: 140 }}>Ποσό αναλογίας</th>
                    <th style={{ ...th, ...money, width: 130 }}>Ιδιοκτήτη</th>
                    <th style={{ ...th, ...money, width: 130 }}>Ενοίκου</th>
                  </tr>
                </thead>
                <tbody>
                  {statement.groups.map((g) => (
                    <tr key={g.key}>
                      <td style={{ ...td, fontWeight: 700 }}>{g.label}</td>
                      <td style={{ ...td, ...money }}>{mill(g.appliedMillesimes)}</td>
                      <td style={{ ...td, ...money, fontWeight: 700 }}>{eur(g.unitAmount)}</td>
                      <td style={{ ...td, ...money }}>{g.unitOwner > 0 ? eur(g.unitOwner) : "—"}</td>
                      <td style={{ ...td, ...money }}>{g.unitTenant > 0 ? eur(g.unitTenant) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td style={grandRow}>ΣΥΝΟΛΟ ΑΝΑΛΟΓΙΑΣ</td>
                    <td style={{ ...grandRow, ...money }} />
                    <td style={{ ...grandRow, ...money }}>{eur(statement.total)}</td>
                    <td style={{ ...grandRow, ...money }}>{statement.ownerTotal > 0 ? eur(statement.ownerTotal) : "—"}</td>
                    <td style={{ ...grandRow, ...money }}>{statement.tenantTotal > 0 ? eur(statement.tenantTotal) : "—"}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {unitReadings.length > 0 && <HeatingReadings rows={unitReadings} />}
          </div>

          {/* ── footer: ΠΛΗΡΩΤΕΟ ΠΟΣΟ + signature ─────────────────────────── */}
          <div style={boxed} data-boxed>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "14px 16px", background: "color-mix(in srgb, var(--color-primary) 8%, transparent)", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: ".05em", color: "var(--muted-foreground)" }}>ΠΛΗΡΩΤΕΟ ΠΟΣΟ</div>
                <div style={{ fontSize: 32, fontWeight: 800, fontVariantNumeric: "tabular-nums", color: "var(--foreground)", lineHeight: 1.15 }}>{eur(statement.myPayable)}</div>
                <div style={{ fontSize: 12.5, color: "var(--muted-foreground)", marginTop: 2 }}>{PAYABLE_CAPTION[statement.role]}</div>
                {statement.role === "OWNER" && statement.myPayable === 0 && statement.tenantTotal > 0 && (
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--muted-foreground)", marginTop: 2 }}>Το σύνολο βαρύνει τον ένοικο</div>
                )}
                {statement.role === "BOTH" && (statement.ownerTotal > 0 || statement.tenantTotal > 0) && (
                  <div style={{ fontSize: 12.5, color: "var(--muted-foreground)", display: "flex", gap: 14, marginTop: 4, flexWrap: "wrap" }}>
                    {statement.ownerTotal > 0 && (
                      <span>Μερίδιο ιδιοκτήτη: <b style={{ color: "var(--foreground)", fontVariantNumeric: "tabular-nums" }}>{eur(statement.ownerTotal)}</b></span>
                    )}
                    {statement.tenantTotal > 0 && (
                      <span>Μερίδιο ενοίκου: <b style={{ color: "var(--foreground)", fontVariantNumeric: "tabular-nums" }}>{eur(statement.tenantTotal)}</b></span>
                    )}
                  </div>
                )}
              </div>
              <StatusChip tone={settled ? "success" : "warning"}>{settled ? "Εξοφλημένο" : "Εκκρεμεί"}</StatusChip>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", padding: "16px 16px 20px", borderTop: "1px solid var(--border)" }}>
              <div style={{ textAlign: "center", minWidth: 200 }}>
                <div style={{ borderTop: "1px solid var(--border-strong)", paddingTop: 6, fontSize: 12, color: "var(--muted-foreground)" }}>
                  Ο/Η Διαχειριστής/τρια
                </div>
                {managerName && <div style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)", marginTop: 3 }}>{managerName}</div>}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** One group's expense lines + subtotal inside the ΑΝΑΛΥΣΗ ΔΑΠΑΝΩΝ table. */
function GroupExpenseRows({ group }: { group: StatementWithPaid["groups"][number] }) {
  return (
    <>
      <tr>
        <td colSpan={2} style={groupRow}>{group.label}</td>
      </tr>
      {group.lines.map((l) => (
        <tr key={l.id}>
          <td style={td}>{l.categoryName}</td>
          <td style={{ ...td, ...money }}>{eur(l.amount)}</td>
        </tr>
      ))}
      <tr>
        <td style={subtotalRow}>Σύνολο ομάδας</td>
        <td style={{ ...subtotalRow, ...money }}>{eur(group.buildingTotal)}</td>
      </tr>
    </>
  );
}

function HeatingReadings({ rows }: { rows: NonNullable<OccupantData["heatingReadings"]> }) {
  return (
    <div style={{ borderTop: "1px dashed var(--border-strong)", padding: "10px 12px", background: "var(--bg-canvas)" }}>
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
