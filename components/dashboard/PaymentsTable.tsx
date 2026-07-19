"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  RiMoneyEuroCircleLine, RiWallet3Line, RiBankCardLine,
  RiExternalLinkLine, RiPrinterLine, RiStackLine, RiLoader4Line,
} from "react-icons/ri";
import { DataTable, type ColDef, type RowAction } from "@/components/ui/data-table";
import { StatTile, StatusChip } from "@/components/dashboard";
import { formatEuro } from "@/lib/dashboard/aggregations";
import { ModalShell } from "@/components/building/occupant-shell/Modal";
import { UnitStatementDocument } from "@/components/building/occupant-shell/UnitStatementDocument";
import { PrintArea } from "@/components/ui/print-area";
import { groupRowsByUnit, type UnitPaymentRow } from "@/lib/dashboard/payment-grouping";
import type { PaymentRow } from "@/lib/dashboard/payment-statements";

type UnitRow = UnitPaymentRow<PaymentRow>;

const GR_MONTHS = [
  "Ιανουάριος", "Φεβρουάριος", "Μάρτιος", "Απρίλιος", "Μάιος", "Ιούνιος",
  "Ιούλιος", "Αύγουστος", "Σεπτέμβριος", "Οκτώβριος", "Νοέμβριος", "Δεκέμβριος",
];
function monthLabel(m: string): string {
  const [y, mo] = m.split("-").map(Number);
  return mo >= 1 && mo <= 12 ? `${GR_MONTHS[mo - 1]} ${y}` : m;
}
const UNIT_TYPE: Record<string, string> = {
  APARTMENT: "Διαμέρισμα", SHOP: "Κατάστημα", PARKING: "Θέση στάθμευσης", OTHER: "Χώρος",
};
const floorLabel = (f: number | null): string =>
  f == null ? "—" : f === 0 ? "Ισόγειο" : f < 0 ? `Υπόγειο ${-f}` : `${f}ος`;
const money: React.CSSProperties = { fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };

/** Settled/owed badge for a single (unit, month) statement — used in the expand. */
function PaymentStatus({ r }: { r: PaymentRow }) {
  if (r.myAmount === 0) return <StatusChip tone="neutral">Καμία οφειλή</StatusChip>;
  return r.myPaid
    ? <StatusChip tone="success">Εξοφλημένο</StatusChip>
    : <StatusChip tone="warning">Οφειλή {formatEuro(r.myAmount)}</StatusChip>;
}

/** Roll-up status for the collapsed unit row: εξοφλημένο / οφειλή / καμία οφειλή. */
function UnitStatus({ r }: { r: UnitRow }) {
  if (r.outstanding > 0) return <StatusChip tone="warning">Οφειλή {formatEuro(r.outstanding)}</StatusChip>;
  if (r.total > 0) return <StatusChip tone="success">Εξοφλημένο</StatusChip>;
  return <StatusChip tone="neutral">Καμία οφειλή</StatusChip>;
}

/**
 * Payments UI for the owner (side OWNER) and resident (side TENANT) portals.
 *
 * ONE ROW PER UNIT: the per-(unit,month) `PaymentRow[]` is collapsed via
 * groupRowsByUnit into totals rows (Συνολική οφειλή), and the full per-month
 * ειδοποιητήριο analysis (UnitStatementDocument) moves into the expand. A
 * «Πληρωμή {outstanding}» button hits POST /api/koinochrista/pay — the amount is
 * ALWAYS recomputed server-side, the client never sends it. The button is gated
 * by `payEnabledByBuilding[buildingId]` (the property's own Viva config + master
 * switch, resolved on the server); disabled «Σύντομα» when off.
 *
 * It imports NO server actions — it only reads `rows`, navigates, and calls the
 * pay route.
 */
export function PaymentsTable({ rows, payEnabledByBuilding = {}, managerName = null, title = "Πληρωμές" }: {
  rows: PaymentRow[]; payEnabledByBuilding?: Record<string, boolean>; managerName?: string | null; title?: string;
}) {
  const router = useRouter();
  const [modal, setModal] = useState<{ month: string } | null>(null);
  const [paying, setPaying] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const unitRows = groupRowsByUnit(rows);
  const totalCharges = unitRows.reduce((a, r) => a + r.total, 0);
  const totalUnpaid = unitRows.reduce((a, r) => a + r.outstanding, 0);

  /** Amount is NEVER sent — the pay route recomputes it from the caller's own unpaid allocations. */
  async function pay(buildingId: string, unitId: string | undefined, rowId: string) {
    setNotice(null);
    setPaying(rowId);
    try {
      const res = await fetch("/api/koinochrista/pay", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ buildingId, unitId }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.checkoutUrl) { window.location.href = j.checkoutUrl; return; }
      setNotice(res.status === 503 ? "Οι online πληρωμές δεν είναι ακόμη διαθέσιμες" : "Σφάλμα πληρωμής");
    } catch {
      setNotice("Σφάλμα πληρωμής");
    } finally {
      setPaying(null);
    }
  }

  const columns: ColDef<UnitRow>[] = [
    {
      id: "building", header: "Ακίνητο", sortKey: "building", width: 220, accessor: (r) => r.buildingName,
      cell: (r) => {
        const src = r.months[0];
        const addr = [src?.buildingAddress, src?.buildingCity].filter(Boolean).join(", ");
        return (
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.buildingName}</div>
            {addr && (
              <div style={{ fontSize: 11, color: "var(--muted-foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{addr}</div>
            )}
          </div>
        );
      },
    },
    {
      id: "unit", header: "Μονάδα", sortKey: "unit", width: 150, accessor: (r) => r.unitNumber,
      cell: (r) => {
        const type = r.months[0]?.unitType;
        return (
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>{r.unitNumber}</div>
            {type && <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{UNIT_TYPE[type] ?? type}</div>}
          </div>
        );
      },
    },
    {
      id: "floor", header: "Όροφος", width: 100, accessor: (r) => r.floor ?? "",
      cell: (r) => <span style={{ fontSize: 13, color: "var(--foreground)" }}>{floorLabel(r.floor)}</span>,
    },
    {
      id: "outstanding", header: "Συνολική οφειλή", sortKey: "outstanding", width: 160, accessor: (r) => r.outstanding,
      cell: (r) => (
        <span style={{ ...money, fontWeight: 700, color: r.outstanding > 0 ? "var(--color-warning)" : "var(--foreground)" }}>
          {formatEuro(r.outstanding)}
        </span>
      ),
    },
    {
      id: "status", header: "Κατάσταση", width: 180, accessor: (r) => (r.outstanding > 0 ? 2 : r.total > 0 ? 1 : 0),
      cell: (r) => <UnitStatus r={r} />,
    },
    {
      id: "pay", header: "", width: 190,
      cell: (r) => {
        if (r.outstanding <= 0) return <span style={{ color: "var(--muted-foreground)" }}>—</span>;
        if (!payEnabledByBuilding[r.buildingId]) {
          return (
            <button type="button" disabled title="Το Viva της ιδιοκτησίας δεν έχει ρυθμιστεί" style={{
              display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 8, padding: "7px 14px",
              border: "1px solid var(--border)", background: "var(--card)", color: "var(--muted-foreground)",
              fontSize: 13, fontWeight: 700, cursor: "not-allowed", whiteSpace: "nowrap",
            }}>
              Σύντομα
            </button>
          );
        }
        const loading = paying === r.id;
        return (
          <button
            type="button"
            disabled={loading}
            onClick={() => pay(r.buildingId, r.unitId, r.id)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 8, padding: "7px 14px",
              border: "1px solid transparent", background: "var(--color-primary)", color: "var(--primary-foreground)",
              fontSize: 13, fontWeight: 700, cursor: loading ? "wait" : "pointer", whiteSpace: "nowrap", opacity: loading ? 0.7 : 1,
            }}
          >
            {loading
              ? <RiLoader4Line style={{ fontSize: 16, animation: "spin 1s linear infinite" }} />
              : <RiBankCardLine style={{ fontSize: 16 }} />}
            Πληρωμή {formatEuro(r.outstanding)}
          </button>
        );
      },
    },
  ];

  const getRowActions = (r: UnitRow): RowAction<UnitRow>[] => {
    const latestMonth = r.months[0]?.month;
    const actions: RowAction<UnitRow>[] = [];
    if (latestMonth) {
      actions.push({ label: "Συνολικό — όλα τα ακίνητα", icon: <RiStackLine />, onClick: () => setModal({ month: latestMonth }) });
    }
    actions.push({
      label: "Πλήρες control center", icon: <RiExternalLinkLine />,
      onClick: () => router.push(`/building/${r.buildingId}?s=koino&unit=${r.unitId}${latestMonth ? `&month=${latestMonth}` : ""}`),
    });
    return actions;
  };

  // Consolidated modal derives its rows client-side from the already-loaded data.
  const consolidatedRows = modal ? rows.filter((r) => r.month === modal.month) : [];
  const activeDocument = modal ? (
    <ConsolidatedDocument month={modal.month} rows={consolidatedRows} managerName={managerName} />
  ) : null;

  return (
    <div className="dash-page" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--foreground)", margin: 0 }}>{title}</h1>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16, maxWidth: 640 }} className="dash-grid">
        <StatTile
          label="Σύνολο οφειλών" value={formatEuro(totalUnpaid)} sub="Εκκρεμείς χρεώσεις"
          icon={RiMoneyEuroCircleLine} valueColor={totalUnpaid > 0 ? "var(--color-warning)" : "var(--foreground)"}
        />
        <StatTile label="Σύνολο χρεώσεων" value={formatEuro(totalCharges)} sub="Όλες οι περίοδοι" icon={RiWallet3Line} />
      </div>

      {notice && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderRadius: "var(--radius-lg)",
          border: "1px solid var(--color-warning)", background: "color-mix(in srgb, var(--color-warning) 10%, transparent)",
          color: "var(--foreground)", fontSize: 13,
        }} role="status">
          <RiMoneyEuroCircleLine style={{ fontSize: 18, flexShrink: 0 }} />
          {notice}
        </div>
      )}

      {unitRows.length === 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border)", background: "var(--card)", color: "var(--muted-foreground)", fontSize: 13,
        }}>
          <RiMoneyEuroCircleLine style={{ fontSize: 18, flexShrink: 0 }} />
          Δεν υπάρχουν εκδοθέντα κοινόχρηστα για τις μονάδες σας ακόμη. Μόλις εκδοθούν, θα εμφανιστούν εδώ ανά μονάδα.
        </div>
      )}

      <DataTable
        data={unitRows}
        columns={columns}
        totalRows={unitRows.length}
        page={1}
        pageSize={25}
        clientSide
        storageKey="payments"
        searchPlaceholder="Αναζήτηση μονάδας ή ακινήτου…"
        expandedContent={(r) => (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {r.months.map((m) => (
              <section key={m.id} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <h4 style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)", margin: 0 }}>{monthLabel(m.month)}</h4>
                  <PaymentStatus r={m} />
                </div>
                <UnitStatementDocument
                  building={{ name: m.buildingName, address: m.buildingAddress, city: m.buildingCity }}
                  statement={m.statement}
                  month={m.month}
                  managerName={managerName}
                  heatingReadings={m.heatingReadings}
                />
              </section>
            ))}
          </div>
        )}
        getRowActions={getRowActions}
      />

      <ModalShell
        open={modal !== null}
        onClose={() => setModal(null)}
        ariaLabel="Συνολικό ειδοποιητήριο κοινοχρήστων"
        maxWidth={860}
        title={modal ? `Συνολικό ειδοποιητήριο · ${monthLabel(modal.month)}` : ""}
        footer={
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button type="button" onClick={() => window.print()} style={{
              display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 6, padding: "8px 15px",
              border: "1px solid var(--border-strong)", background: "var(--card)", color: "var(--foreground)",
              fontSize: 13, fontWeight: 700, cursor: "pointer",
            }}>
              <RiPrinterLine style={{ fontSize: 16 }} /> Εκτύπωση
            </button>
          </div>
        }
      >
        {activeDocument}
      </ModalShell>

      {/* Print target for the consolidated modal — body-level, shown only in print. */}
      {modal && <PrintArea>{activeDocument}</PrintArea>}
    </div>
  );
}

/**
 * Consolidated «όλα τα ακίνητα» notice for one month: one row per (unit,month)
 * across the viewer's whole portfolio with its πληρωτέο + κατάσταση, plus a
 * grand-total. Printable through the same `<PrintArea>` (data-boxed → black rules).
 */
function ConsolidatedDocument({ month, rows, managerName }: {
  month: string; rows: PaymentRow[]; managerName: string | null;
}) {
  const totalPayable = rows.reduce((a, r) => a + r.myAmount, 0);
  const boxed: React.CSSProperties = { border: "1px solid var(--border-strong)", borderRadius: 10, overflow: "hidden", background: "var(--card)" };
  const th: React.CSSProperties = {
    padding: "7px 12px", fontSize: 11.5, fontWeight: 700, textAlign: "left",
    textTransform: "uppercase", letterSpacing: ".03em", color: "var(--muted-foreground)",
    borderBottom: "1px solid var(--border-strong)",
  };
  const td: React.CSSProperties = { padding: "8px 12px", fontSize: 13, color: "var(--foreground)", borderBottom: "1px solid var(--border)" };
  const moneyCell: React.CSSProperties = { textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };
  const grand: React.CSSProperties = { ...td, fontWeight: 800, borderBottom: "none", borderTop: "2px solid var(--border-strong)", background: "var(--bg-canvas)" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={boxed} data-boxed>
        <div style={{ padding: "10px 14px", textAlign: "center", fontSize: 15, fontWeight: 800, letterSpacing: ".06em", borderBottom: "1px solid var(--border-strong)", color: "var(--foreground)" }}>
          ΣΥΝΟΛΙΚΟ ΕΙΔΟΠΟΙΗΤΗΡΙΟ ΚΟΙΝΟΧΡΗΣΤΩΝ
        </div>
        <div style={{ padding: "9px 14px", fontSize: 13, color: "var(--muted-foreground)", display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <span>Μήνας: <b style={{ color: "var(--foreground)" }}>{monthLabel(month)}</b></span>
          <span>{rows.length} {rows.length === 1 ? "ακίνητο" : "ακίνητα"}</span>
        </div>
      </div>

      <div style={boxed} data-boxed>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>Ακίνητο</th>
                <th style={th}>Μονάδα</th>
                <th style={{ ...th, width: 100 }}>Όροφος</th>
                <th style={{ ...th, ...moneyCell, width: 140 }}>Πληρωτέο</th>
                <th style={{ ...th, width: 160 }}>Κατάσταση</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={5} style={{ ...td, textAlign: "center", color: "var(--muted-foreground)" }}>Καμία εγγραφή για τον μήνα.</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id}>
                    <td style={td}>
                      <div style={{ fontWeight: 600 }}>{r.buildingName}</div>
                      {(r.buildingAddress || r.buildingCity) && (
                        <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{[r.buildingAddress, r.buildingCity].filter(Boolean).join(", ")}</div>
                      )}
                    </td>
                    <td style={td}>{r.unitNumber}</td>
                    <td style={td}>{floorLabel(r.floor)}</td>
                    <td style={{ ...td, ...moneyCell, fontWeight: 700 }}>{formatEuro(r.myAmount)}</td>
                    <td style={td}><PaymentStatus r={r} /></td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr>
                <td style={grand} colSpan={3}>ΣΥΝΟΛΟ ΠΛΗΡΩΤΕΟ</td>
                <td style={{ ...grand, ...moneyCell }}>{formatEuro(totalPayable)}</td>
                <td style={grand} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {managerName && (
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "4px 4px 0" }}>
          <div style={{ textAlign: "center", minWidth: 200 }}>
            <div style={{ borderTop: "1px solid var(--border-strong)", paddingTop: 6, fontSize: 12, color: "var(--muted-foreground)" }}>Ο/Η Διαχειριστής/τρια</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)", marginTop: 3 }}>{managerName}</div>
          </div>
        </div>
      )}
    </div>
  );
}
