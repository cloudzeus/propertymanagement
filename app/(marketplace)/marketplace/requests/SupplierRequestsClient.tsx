"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { DataTable, type ColDef } from "@/components/ui/data-table";
import { STATUS_LABELS, STATUS_COLORS, PRIORITY_LABELS, type FaultStatus } from "@/lib/maintenance-shared";
import { RiEyeLine, RiToolsLine } from "react-icons/ri";
import type { FaultListItem } from "@/components/maintenance/types";

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("el-GR", { dateStyle: "short", timeStyle: "short" }) : "—");
const CLOSED = ["COMPLETED", "CANCELLED"];

export function SupplierRequestsClient({ items }: { items: FaultListItem[] }) {
  const router = useRouter();
  const open = items.filter((i) => !CLOSED.includes(i.status)).length;
  const scheduled = items.filter((i) => i.status === "SCHEDULED").length;
  const done = items.filter((i) => i.status === "COMPLETED").length;

  const columns: ColDef<FaultListItem>[] = [
    { id: "title", header: "Εργασία", width: 260, accessor: (r) => r.title, sortKey: "title",
      cell: (r) => <Link href={`/marketplace/requests/${r.id}`} style={{ fontWeight: 600, color: "var(--foreground)", textDecoration: "none" }}>{r.title}</Link> },
    { id: "status", header: "Κατάσταση", width: 130, accessor: (r) => r.status, sortKey: "status",
      cell: (r) => { const c = STATUS_COLORS[r.status as FaultStatus] ?? "#6b7280"; return <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: "var(--fs-11-5)", fontWeight: 600, color: c, background: `${c}18`, border: `1px solid ${c}40` }}>{STATUS_LABELS[r.status as FaultStatus] ?? r.status}</span>; } },
    { id: "priority", header: "Προτεραιότητα", width: 110, accessor: (r) => r.priority, cell: (r) => PRIORITY_LABELS[r.priority as keyof typeof PRIORITY_LABELS] ?? r.priority },
    { id: "category", header: "Κατηγορία", width: 140, accessor: (r) => r.categoryName ?? "", cell: (r) => r.categoryName ?? "—" },
    { id: "building", header: "Κτήριο", width: 240, accessor: (r) => r.buildingName, cell: (r) => <>{r.buildingName}{r.unitLabel ? ` · ${r.unitLabel}` : ""}</> },
    { id: "scheduled", header: "Ραντεβού", width: 140, accessor: (r) => r.scheduledDate ?? "", sortKey: "scheduled", cell: (r) => fmt(r.scheduledDate) },
    { id: "created", header: "Ανατέθηκε", width: 140, accessor: (r) => r.createdAt, sortKey: "created", cell: (r) => fmt(r.createdAt) },
  ];

  return (
    <div className="dash-page" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <h1 style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "var(--fs-22)", fontWeight: 700, color: "var(--foreground)", margin: 0 }}><RiToolsLine style={{ color: "var(--color-primary)" }} /> Αναθέσεις</h1>
        <p style={{ margin: "4px 0 0", fontSize: "var(--fs-13)", color: "var(--muted-foreground)" }}>Εργασίες που σας ανέθεσε η εταιρεία διαχείρισης. Ενημερώνετε την κατάσταση και επικοινωνείτε από τη σελίδα κάθε εργασίας.</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        {[{ label: "Ανοιχτές", value: open }, { label: "Με ραντεβού", value: scheduled }, { label: "Ολοκληρωμένες", value: done }].map((k) => (
          <div key={k.label} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "14px 16px" }}>
            <div style={{ fontSize: "var(--fs-12)", color: "var(--muted-foreground)" }}>{k.label}</div>
            <div style={{ fontSize: "var(--fs-24)", fontWeight: 700, color: "var(--foreground)" }}>{k.value}</div>
          </div>
        ))}
      </div>
      <DataTable
        data={items} columns={columns} totalRows={items.length} page={1} pageSize={25} clientSide
        storageKey="marketplace-requests" searchPlaceholder="Αναζήτηση εργασίας…"
        getRowActions={(r) => [{ label: "Προβολή", icon: <RiEyeLine />, onClick: () => router.push(`/marketplace/requests/${r.id}`) }]}
      />
    </div>
  );
}
