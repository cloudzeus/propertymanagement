"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  RiMoneyEuroCircleLine, RiWallet3Line, RiFileTextLine,
  RiExternalLinkLine, RiPrinterLine, RiStackLine,
} from "react-icons/ri";
import { DataTable, type ColDef, type RowAction } from "@/components/ui/data-table";
import { StatTile, StatusChip } from "@/components/dashboard";
import { formatEuro } from "@/lib/dashboard/aggregations";
import { ModalShell } from "@/components/building/occupant-shell/Modal";
import { UnitStatementDocument } from "@/components/building/occupant-shell/UnitStatementDocument";
import { PrintArea } from "@/components/ui/print-area";
import type { PaymentRow } from "@/lib/dashboard/payment-statements";

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

/** The account modal is either a single-unit notice or the consolidated all-properties view. */
type PaymentsModal = { kind: "unit"; row: PaymentRow } | { kind: "all"; month: string } | null;

/** Settled/owed badge for a payment row — shared by the table column + consolidated modal. */
function PaymentStatus({ r }: { r: PaymentRow }) {
  if (r.myAmount === 0) return <StatusChip tone="neutral">Καμία οφειλή</StatusChip>;
  return r.myPaid
    ? <StatusChip tone="success">Εξοφλημένο</StatusChip>
    : <StatusChip tone="warning">Οφειλή {formatEuro(r.myAmount)}</StatusChip>;
}

/**
 * Payments UI for the owner (side OWNER) and resident (side TENANT) portals.
 * One row per (unit, month); expand renders the FULL ειδοποιητήριο analysis
 * (UnitStatementDocument — διαμοιρασμός ενοικιαστές/ιδιοκτήτες, σύνολα, χιλιοστά)
 * inline; «Προβολή λογαριασμού» opens the same notice in a print modal.
 *
 * Read-only: it imports NO server actions — it only reads `rows` and navigates.
 */
export function PaymentsTable({ rows, managerName = null, title = "Πληρωμές" }: {
  rows: PaymentRow[]; managerName?: string | null; title?: string;
}) {
  const router = useRouter();
  const [modal, setModal] = useState<PaymentsModal>(null);

  const totalCharges = rows.reduce((a, r) => a + r.myAmount, 0);
  const totalUnpaid = rows.reduce((a, r) => a + (r.myPaid ? 0 : r.myAmount), 0);

  const columns: ColDef<PaymentRow>[] = [
    {
      // Accessor drives both search + sort: the ISO prefix keeps sort chronological
      // while the Greek label makes «Αναζήτηση μήνα» match the visible text.
      id: "month", header: "Μήνας", sortKey: "month", width: 150, accessor: (r) => `${r.month} ${monthLabel(r.month)}`,
      cell: (r) => <span style={{ fontWeight: 600, color: "var(--foreground)" }}>{monthLabel(r.month)}</span>,
    },
    {
      id: "building", header: "Ακίνητο", sortKey: "building", width: 210, accessor: (r) => r.buildingName,
      cell: (r) => (
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.buildingName}</div>
          {(r.buildingAddress || r.buildingCity) && (
            <div style={{ fontSize: 11, color: "var(--muted-foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {[r.buildingAddress, r.buildingCity].filter(Boolean).join(", ")}
            </div>
          )}
        </div>
      ),
    },
    {
      id: "unit", header: "Μονάδα", sortKey: "unit", width: 150, accessor: (r) => r.unitNumber,
      cell: (r) => (
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>{r.unitNumber}</div>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{UNIT_TYPE[r.unitType] ?? r.unitType}</div>
        </div>
      ),
    },
    {
      id: "floor", header: "Όροφος", width: 100, defaultVisible: true, accessor: (r) => r.floor ?? "",
      cell: (r) => <span style={{ fontSize: 13, color: "var(--foreground)" }}>{floorLabel(r.floor)}</span>,
    },
    {
      id: "myAmount", header: "Το μερίδιό μου", sortKey: "myAmount", width: 150, accessor: (r) => r.myAmount,
      cell: (r) => (
        <span style={{ ...money, fontWeight: 700, color: !r.myPaid && r.myAmount > 0 ? "var(--color-warning)" : "var(--foreground)" }}>
          {formatEuro(r.myAmount)}
        </span>
      ),
    },
    {
      id: "status", header: "Κατάσταση", width: 170, accessor: (r) => (r.myAmount === 0 ? 0 : r.myPaid ? 1 : 2),
      cell: (r) => <PaymentStatus r={r} />,
    },
  ];

  const getRowActions = (r: PaymentRow): RowAction<PaymentRow>[] => [
    { label: "Ανάλυση ακινήτου", icon: <RiFileTextLine />, onClick: () => setModal({ kind: "unit", row: r }) },
    { label: "Συνολικό — όλα τα ακίνητα", icon: <RiStackLine />, onClick: () => setModal({ kind: "all", month: r.month }) },
    {
      label: "Πλήρες control center", icon: <RiExternalLinkLine />,
      onClick: () => router.push(`/building/${r.buildingId}?s=koino&month=${r.month}&unit=${r.unitId}`),
    },
  ];

  // Consolidated modal derives its rows client-side from the already-loaded data.
  const consolidatedRows = modal?.kind === "all" ? rows.filter((r) => r.month === modal.month) : [];
  const modalTitle = !modal
    ? ""
    : modal.kind === "unit"
      ? `Λογαριασμός · ${monthLabel(modal.row.month)} · ${modal.row.unitNumber}`
      : `Συνολικό ειδοποιητήριο · ${monthLabel(modal.month)}`;

  // The active document, rendered both in the modal body and (unstyled) in the PrintArea.
  const activeDocument = !modal ? null : modal.kind === "unit" ? (
    <UnitStatementDocument
      building={{ name: modal.row.buildingName, address: modal.row.buildingAddress, city: modal.row.buildingCity }}
      statement={modal.row.statement}
      month={modal.row.month}
      managerName={managerName}
      heatingReadings={modal.row.heatingReadings}
    />
  ) : (
    <ConsolidatedDocument month={modal.month} rows={consolidatedRows} managerName={managerName} />
  );

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

      {rows.length === 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border)", background: "var(--card)", color: "var(--muted-foreground)", fontSize: 13,
        }}>
          <RiMoneyEuroCircleLine style={{ fontSize: 18, flexShrink: 0 }} />
          Δεν υπάρχουν εκδοθέντα κοινόχρηστα για τις μονάδες σας ακόμη. Μόλις εκδοθούν, θα εμφανιστούν εδώ ανά μήνα.
        </div>
      )}

      <DataTable
        data={rows}
        columns={columns}
        totalRows={rows.length}
        page={1}
        pageSize={25}
        clientSide
        storageKey="payments"
        searchPlaceholder="Αναζήτηση μήνα ή ακινήτου…"
        expandedContent={(r) => (
          <UnitStatementDocument
            building={{ name: r.buildingName, address: r.buildingAddress, city: r.buildingCity }}
            statement={r.statement}
            month={r.month}
            managerName={managerName}
            heatingReadings={r.heatingReadings}
          />
        )}
        getRowActions={getRowActions}
      />

      <ModalShell
        open={modal !== null}
        onClose={() => setModal(null)}
        ariaLabel="Λογαριασμός κοινοχρήστων"
        maxWidth={860}
        title={modalTitle}
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

      {/* Print target for the account modal — body-level, shown only in print. */}
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
