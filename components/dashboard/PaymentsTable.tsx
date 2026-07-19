"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  RiMoneyEuroCircleLine, RiWallet3Line, RiFileTextLine, RiDownloadLine,
  RiExternalLinkLine, RiPrinterLine,
} from "react-icons/ri";
import { DataTable, type ColDef, type RowAction } from "@/components/ui/data-table";
import { StatTile, StatusChip } from "@/components/dashboard";
import { formatEuro } from "@/lib/dashboard/aggregations";
import { ModalShell } from "@/components/building/occupant-shell/Modal";
import { UnitStatementDocument } from "@/components/building/occupant-shell/UnitStatementDocument";
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
const money: React.CSSProperties = { fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };

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
  const [modal, setModal] = useState<PaymentRow | null>(null);

  const totalCharges = rows.reduce((a, r) => a + r.myAmount, 0);
  const totalUnpaid = rows.reduce((a, r) => a + (r.myPaid ? 0 : r.myAmount), 0);

  const columns: ColDef<PaymentRow>[] = [
    {
      id: "month", header: "Μήνας", sortKey: "month", width: 150, accessor: (r) => r.month,
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
      id: "myAmount", header: "Το μερίδιό μου", sortKey: "myAmount", width: 150, accessor: (r) => r.myAmount,
      cell: (r) => (
        <span style={{ ...money, fontWeight: 700, color: !r.myPaid && r.myAmount > 0 ? "var(--color-warning)" : "var(--foreground)" }}>
          {formatEuro(r.myAmount)}
        </span>
      ),
    },
    {
      id: "status", header: "Κατάσταση", width: 170, accessor: (r) => (r.myAmount === 0 ? 0 : r.myPaid ? 1 : 2),
      cell: (r) =>
        r.myAmount === 0
          ? <StatusChip tone="neutral">Καμία οφειλή</StatusChip>
          : r.myPaid
            ? <StatusChip tone="success">Εξοφλημένο</StatusChip>
            : <StatusChip tone="warning">Οφειλή {formatEuro(r.myAmount)}</StatusChip>,
    },
  ];

  const getRowActions = (r: PaymentRow): RowAction<PaymentRow>[] => [
    { label: "Προβολή λογαριασμού", icon: <RiFileTextLine />, onClick: () => setModal(r) },
    ...r.receiptUrls.map((u, i) => ({
      label: r.receiptUrls.length > 1 ? `Απόδειξη ${i + 1}` : "Απόδειξη",
      icon: <RiDownloadLine />,
      onClick: () => window.open(u, "_blank", "noopener,noreferrer"),
    })),
    {
      label: "Πλήρες control center", icon: <RiExternalLinkLine />,
      onClick: () => router.push(`/building/${r.buildingId}?s=koino&month=${r.month}&unit=${r.unitId}`),
    },
  ];

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
            showPrintRoot={false}
          />
        )}
        getRowActions={getRowActions}
      />

      <ModalShell
        open={modal !== null}
        onClose={() => setModal(null)}
        ariaLabel="Λογαριασμός κοινοχρήστων"
        maxWidth={860}
        title={modal ? `Λογαριασμός · ${monthLabel(modal.month)} · ${modal.unitNumber}` : ""}
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
        {modal && (
          <UnitStatementDocument
            building={{ name: modal.buildingName, address: modal.buildingAddress, city: modal.buildingCity }}
            statement={modal.statement}
            month={modal.month}
            managerName={managerName}
            showPrintRoot
          />
        )}
      </ModalShell>
    </div>
  );
}
