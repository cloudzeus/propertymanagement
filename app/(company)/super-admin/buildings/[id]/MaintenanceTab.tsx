"use client";

import { DataTable, type ColDef } from "@/components/ui/data-table";
import { RiFileDownloadLine } from "react-icons/ri";
import type { listMaintenanceHistory } from "@/app/actions/maintenance-logs";

export type MaintenanceHistoryRow = Awaited<ReturnType<typeof listMaintenanceHistory>>[number];

const KIND_LABEL: Record<string, string> = {
  GENERAL: "Γενική",
  ELEVATOR: "Ανελκυστήρας",
  BOILER: "Λέβητας/Καυστήρας",
  FIRE_SAFETY: "Πυρασφάλεια",
  HVAC: "Κλιματισμός",
  ELECTRICAL: "Ηλεκτρολογικά",
  PLUMBING: "Υδραυλικά",
  OTHER: "Άλλο",
};

export function MaintenanceTab({ rows }: { rows: MaintenanceHistoryRow[] }) {
  const columns: ColDef<MaintenanceHistoryRow>[] = [
    {
      id: "performedAt", header: "Ημερομηνία", sortKey: "performedAt", width: 130,
      accessor: (r) => r.performedAt,
      cell: (r) => <span style={{ fontSize: 13, color: "var(--foreground)" }}>{new Date(r.performedAt).toLocaleDateString("el-GR")}</span>,
    },
    {
      id: "kind", header: "Τύπος", sortKey: "kind", width: 160,
      accessor: (r) => KIND_LABEL[r.kind] ?? r.kind,
      cell: (r) => <span style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)" }}>{KIND_LABEL[r.kind] ?? r.kind}</span>,
    },
    {
      id: "title", header: "Τίτλος", sortKey: "title", width: 240,
      accessor: (r) => r.title,
      cell: (r) => <span style={{ fontSize: 13, color: "var(--foreground)" }}>{r.title}</span>,
    },
    {
      id: "performedBy", header: "Ποιος", width: 160,
      accessor: (r) => r.performedBy ?? "",
      cell: (r) => <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{r.performedBy ?? "—"}</span>,
    },
    {
      id: "cost", header: "Κόστος", width: 110,
      accessor: (r) => r.cost ?? "",
      cell: (r) => <span style={{ fontSize: 13, color: "var(--foreground)" }}>{r.cost ? `${r.cost} €` : "—"}</span>,
    },
    {
      id: "document", header: "Πιστοποιητικό", width: 180,
      cell: (r) => r.documentUrl ? (
        <a href={r.documentUrl} target="_blank" rel="noopener" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--color-primary)", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
          <RiFileDownloadLine /> {r.documentName ?? "Άνοιγμα"}
        </a>
      ) : <span style={{ color: "var(--muted-foreground)" }}>—</span>,
    },
  ];

  return (
    <DataTable
      data={rows}
      columns={columns}
      totalRows={rows.length}
      page={1}
      pageSize={25}
      clientSide
      sortBy="performedAt"
      sortDir="desc"
      storageKey="building-maintenance"
      searchPlaceholder="Αναζήτηση συντήρησης…"
    />
  );
}
