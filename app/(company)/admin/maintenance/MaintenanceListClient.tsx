"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { DataTable, type ColDef } from "@/components/ui/data-table";
import { NewRequestButton } from "@/components/maintenance/new-request-form";
import { STATUS_LABELS, STATUS_COLORS, PRIORITY_LABELS, HANDLER_LABELS, type FaultStatus } from "@/lib/maintenance-shared";
import { RiSettings3Line, RiEyeLine } from "react-icons/ri";
import type { FaultListItem, BuildingOption, CategoryOption } from "@/components/maintenance/types";

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("el-GR", { dateStyle: "short", timeStyle: "short" }) : "—");

function StatusPill({ status }: { status: string }) {
  const color = STATUS_COLORS[status as FaultStatus] ?? "#6b7280";
  return (
    <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 11.5, fontWeight: 600, color, background: `${color}18`, border: `1px solid ${color}40` }}>
      {STATUS_LABELS[status as FaultStatus] ?? status}
    </span>
  );
}

export function MaintenanceListClient({ items, canEditSettings, buildings, categories }: {
  items: FaultListItem[];
  canEditSettings: boolean;
  buildings: BuildingOption[];
  categories: CategoryOption[];
}) {
  const router = useRouter();

  const open = items.filter((i) => !["COMPLETED", "CANCELLED"].includes(i.status)).length;
  const overdue = items.filter((i) => i.slaDueAt && new Date(i.slaDueAt) < new Date() && !["COMPLETED", "CANCELLED"].includes(i.status)).length;
  const company = items.filter((i) => i.handledBy === "COMPANY" && !["COMPLETED", "CANCELLED"].includes(i.status)).length;

  const columns: ColDef<FaultListItem>[] = [
    { id: "title", header: "Τίτλος", width: 240, accessor: (r) => r.title, sortKey: "title",
      cell: (r) => <Link href={`/admin/maintenance/${r.id}`} style={{ fontWeight: 600, color: "var(--foreground)", textDecoration: "none" }}>{r.title}</Link> },
    { id: "status", header: "Κατάσταση", width: 130, accessor: (r) => r.status, sortKey: "status", cell: (r) => <StatusPill status={r.status} /> },
    { id: "priority", header: "Προτεραιότητα", width: 110, accessor: (r) => r.priority, cell: (r) => PRIORITY_LABELS[r.priority as keyof typeof PRIORITY_LABELS] ?? r.priority },
    { id: "category", header: "Κατηγορία", width: 140, accessor: (r) => r.categoryName ?? "", cell: (r) => r.categoryName ?? "—" },
    { id: "building", header: "Κτήριο", width: 160, accessor: (r) => r.buildingName, cell: (r) => <>{r.buildingName}{r.unitLabel ? ` · ${r.unitLabel}` : ""}</> },
    { id: "handledBy", header: "Υπεύθυνος", width: 150, accessor: (r) => r.handledBy, cell: (r) => HANDLER_LABELS[r.handledBy] ?? r.handledBy },
    { id: "assignee", header: "Ανάθεση", width: 130, accessor: (r) => r.assigneeName ?? "", cell: (r) => r.assigneeName ?? "—" },
    { id: "sla", header: "SLA", width: 140, accessor: (r) => r.slaDueAt ?? "", sortKey: "sla",
      cell: (r) => {
        if (!r.slaDueAt || ["COMPLETED", "CANCELLED"].includes(r.status)) return "—";
        const late = new Date(r.slaDueAt) < new Date();
        return <span style={{ color: late ? "#9f1239" : "var(--foreground)", fontWeight: late ? 700 : 400 }}>{fmt(r.slaDueAt)}</span>;
      } },
    { id: "created", header: "Δηλώθηκε", width: 140, accessor: (r) => r.createdAt, sortKey: "created", cell: (r) => fmt(r.createdAt) },
    { id: "reporter", header: "Από", width: 140, defaultVisible: false, accessor: (r) => r.reporterName ?? "", cell: (r) => r.reporterName ?? "—" },
  ];

  return (
    <div className="dash-page" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--foreground)", margin: 0, flex: 1 }}>Βλάβες</h1>
        <NewRequestButton buildings={buildings} categories={categories} detailBase="/admin/maintenance" />
        {canEditSettings && (
          <Link href="/admin/maintenance/settings" style={{
            display: "inline-flex", alignItems: "center", gap: 6, height: 36, padding: "0 12px",
            border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", fontSize: 13,
            color: "var(--foreground)", textDecoration: "none", background: "var(--card)",
          }}>
            <RiSettings3Line /> Ρυθμίσεις
          </Link>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        {[
          { label: "Ανοιχτές βλάβες", value: open },
          { label: "Εκτός SLA", value: overdue, danger: overdue > 0 },
          { label: "Ευθύνη εταιρίας", value: company },
        ].map((k) => (
          <div key={k.label} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "14px 16px" }}>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{k.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: (k as any).danger ? "#9f1239" : "var(--foreground)" }}>{k.value}</div>
          </div>
        ))}
      </div>

      <DataTable
        data={items}
        columns={columns}
        totalRows={items.length}
        page={1}
        pageSize={25}
        clientSide
        storageKey="maintenance-list"
        searchPlaceholder="Αναζήτηση βλάβης…"
        getRowActions={(r) => [{ label: "Προβολή", icon: <RiEyeLine />, onClick: () => router.push(`/admin/maintenance/${r.id}`) }]}
      />
    </div>
  );
}
