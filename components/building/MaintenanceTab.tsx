"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type ColDef } from "@/components/ui/data-table";
import { RiFileDownloadLine, RiAddLine, RiEditLine, RiCheckboxCircleLine } from "react-icons/ri";
import type { listMaintenanceHistory } from "@/app/actions/maintenance-logs";
import { TaskModal, CompleteModal, type TaskRow } from "./CalendarPanel";
import type { BuildingCaps } from "@/lib/building-caps";

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

const FREQ_LABEL: Record<string, string> = {
  WEEKLY: "Εβδομαδιαία",
  MONTHLY: "Μηνιαία",
  QUARTERLY: "Τριμηνιαία",
  SEMIANNUAL: "Εξαμηνιαία",
  ANNUAL: "Ετήσια",
  CUSTOM: "Μία φορά",
};

const cellText = { fontSize: 13, color: "var(--foreground)" } as const;
const cellMuted = { fontSize: 12, color: "var(--muted-foreground)" } as const;

export function MaintenanceTab({
  rows,
  tasks,
  buildingId,
  can,
}: {
  rows: MaintenanceHistoryRow[];
  tasks: TaskRow[];
  buildingId: string;
  can: BuildingCaps;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<TaskRow | null | "new">(null);
  const [completing, setCompleting] = useState<TaskRow | null>(null);

  const scheduledCols: ColDef<TaskRow>[] = [
    {
      id: "kind", header: "Τύπος", sortKey: "kind", width: 150,
      accessor: (r) => KIND_LABEL[r.kind] ?? r.kind,
      cell: (r) => <span style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)" }}>{KIND_LABEL[r.kind] ?? r.kind}</span>,
    },
    {
      id: "title", header: "Τίτλος", sortKey: "title", width: 220,
      accessor: (r) => r.title,
      cell: (r) => <span style={cellText}>{r.title}</span>,
    },
    {
      id: "frequency", header: "Συχνότητα", width: 120,
      accessor: (r) => FREQ_LABEL[r.frequency] ?? r.frequency,
      cell: (r) => <span style={cellMuted}>{FREQ_LABEL[r.frequency] ?? r.frequency}</span>,
    },
    {
      id: "nextDueDate", header: "Επόμενη", sortKey: "nextDueDate", width: 120,
      accessor: (r) => r.nextDueDate ?? "",
      cell: (r) => <span style={cellText}>{r.nextDueDate ? new Date(r.nextDueDate).toLocaleDateString("el-GR") : "—"}</span>,
    },
    {
      id: "inServicePackage", header: "Πακέτο", width: 90,
      accessor: (r) => (r.inServicePackage ? "Ναι" : "Όχι"),
      cell: (r) => <span style={cellMuted}>{r.inServicePackage ? "Ναι" : "Όχι"}</span>,
    },
    {
      id: "vendor", header: "Ανάδοχος", width: 150,
      accessor: (r) => r.vendor ?? "",
      cell: (r) => <span style={cellMuted}>{r.vendor ?? "—"}</span>,
    },
    ...(can.manageMaintenance ? [{
      id: "actions", header: "", width: 190,
      cell: (r: TaskRow) => (
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => setEditing(r)} style={rowBtn}><RiEditLine /> Επεξεργασία</button>
          <button onClick={() => setCompleting(r)} style={rowBtn}><RiCheckboxCircleLine /> Ολοκλήρωση</button>
        </div>
      ),
    } satisfies ColDef<TaskRow>] : []),
  ];

  const historyCols: ColDef<MaintenanceHistoryRow>[] = [
    {
      id: "performedAt", header: "Ημερομηνία", sortKey: "performedAt", width: 130,
      accessor: (r) => r.performedAt,
      cell: (r) => <span style={cellText}>{new Date(r.performedAt).toLocaleDateString("el-GR")}</span>,
    },
    {
      id: "kind", header: "Τύπος", sortKey: "kind", width: 150,
      accessor: (r) => KIND_LABEL[r.kind] ?? r.kind,
      cell: (r) => <span style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)" }}>{KIND_LABEL[r.kind] ?? r.kind}</span>,
    },
    {
      id: "title", header: "Τίτλος", sortKey: "title", width: 220,
      accessor: (r) => r.title,
      cell: (r) => <span style={cellText}>{r.title}</span>,
    },
    {
      id: "performedBy", header: "Ποιος", width: 150,
      accessor: (r) => r.performedBy ?? "",
      cell: (r) => <span style={cellMuted}>{r.performedBy ?? "—"}</span>,
    },
    {
      id: "cost", header: "Κόστος", width: 100,
      accessor: (r) => r.cost ?? "",
      cell: (r) => <span style={cellText}>{r.cost ? `${r.cost} €` : "—"}</span>,
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
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--foreground)", margin: 0 }}>Προγραμματισμένες συντηρήσεις</h3>
          {can.manageMaintenance && <button onClick={() => setEditing("new")} style={addBtn}><RiAddLine /> Προσθήκη συντήρησης</button>}
        </div>
        <DataTable
          data={tasks}
          columns={scheduledCols}
          totalRows={tasks.length}
          page={1}
          pageSize={25}
          clientSide
          sortBy="nextDueDate"
          sortDir="asc"
          storageKey="building-maintenance-scheduled"
          searchPlaceholder="Αναζήτηση συντήρησης…"
        />
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--foreground)", margin: 0 }}>Ιστορικό συντηρήσεων</h3>
        <DataTable
          data={rows}
          columns={historyCols}
          totalRows={rows.length}
          page={1}
          pageSize={25}
          clientSide
          sortBy="performedAt"
          sortDir="desc"
          storageKey="building-maintenance-history"
          searchPlaceholder="Αναζήτηση στο ιστορικό…"
        />
      </section>

      {editing !== null && (
        <TaskModal
          buildingId={buildingId}
          editing={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onComplete={(t) => { setEditing(null); setCompleting(t); }}
          onDone={() => { setEditing(null); router.refresh(); }}
        />
      )}
      {completing && (
        <CompleteModal
          task={completing}
          onClose={() => setCompleting(null)}
          onDone={() => { setCompleting(null); router.refresh(); }}
        />
      )}
    </div>
  );
}

const rowBtn = {
  display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 6,
  border: "1px solid var(--border)", background: "var(--bg-canvas)", color: "var(--foreground)",
  fontSize: 12, fontWeight: 500, cursor: "pointer",
} as const;

const addBtn = {
  display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8,
  border: "none", background: "var(--color-primary)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
} as const;
