"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { DataTable, type ColDef } from "@/components/ui/data-table";
import { WO_STATUS_LABELS, WO_STATUS_COLORS, eur, withVat, type WorkOrderDTO } from "@/lib/rfq-shared";
import { RiFileListLine, RiEyeLine } from "react-icons/ri";

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("el-GR", { dateStyle: "short", timeStyle: "short" }) : "—");

export function WorkOrdersClient({ items }: { items: WorkOrderDTO[] }) {
  const router = useRouter();
  const pending = items.filter((w) => w.status === "PENDING_CUSTOMER").length;
  const active = items.filter((w) => ["ACCEPTED", "SCHEDULED", "IN_PROGRESS"].includes(w.status)).length;
  const awaiting = items.filter((w) => w.status === "COMPLETED").length;
  const margin = items.filter((w) => ["CONFIRMED", "COMPLETED", "IN_PROGRESS", "SCHEDULED", "ACCEPTED"].includes(w.status) && !w.covered).reduce((s, w) => s + (w.customerPrice - (w.supplierPrice ?? 0)), 0);

  const columns: ColDef<WorkOrderDTO>[] = [
    { id: "number", header: "Αρ.", width: 120, sortKey: "number", accessor: (r) => r.number, cell: (r) => <Link href={r.maintenanceRequestId ? `/admin/maintenance/${r.maintenanceRequestId}` : "#"} style={{ fontWeight: 700, color: "var(--foreground)", textDecoration: "none" }}>{r.number}</Link> },
    { id: "title", header: "Εργασία", width: 260, accessor: (r) => r.title, cell: (r) => <><div>{r.title}</div><div style={{ fontSize: "var(--fs-11-5)", color: "var(--muted-foreground)" }}>{r.buildingName}</div></> },
    { id: "status", header: "Κατάσταση", width: 170, accessor: (r) => r.status, sortKey: "status", cell: (r) => { const c = WO_STATUS_COLORS[r.status] ?? "#6b7280"; return <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: "var(--fs-11-5)", fontWeight: 600, color: c, background: `${c}18`, border: `1px solid ${c}40` }}>{WO_STATUS_LABELS[r.status] ?? r.status}</span>; } },
    { id: "supplier", header: "Συνεργάτης", width: 180, accessor: (r) => r.supplierName ?? "", cell: (r) => r.supplierName ?? "—" },
    { id: "supplierPrice", header: "Τιμή συνεργάτη", width: 130, accessor: (r) => r.supplierPrice ?? 0, cell: (r) => <span style={{ fontVariantNumeric: "tabular-nums" }}>{eur(r.supplierPrice)}</span> },
    { id: "customerPrice", header: "Τιμή πελάτη", width: 130, accessor: (r) => r.customerPrice, cell: (r) => <span style={{ fontVariantNumeric: "tabular-nums" }}>{r.covered ? "καλύπτεται" : `${eur(r.customerPrice)} (${eur(withVat(r.customerPrice, r.vatPct))})`}</span> },
    { id: "margin", header: "Περιθώριο", width: 110, accessor: (r) => r.customerPrice - (r.supplierPrice ?? 0), cell: (r) => <span style={{ fontVariantNumeric: "tabular-nums", color: "#15803d", fontWeight: 600 }}>{r.covered ? "—" : eur(r.customerPrice - (r.supplierPrice ?? 0))}</span> },
    { id: "scheduled", header: "Ραντεβού", width: 140, accessor: (r) => r.scheduledAt ?? "", cell: (r) => fmt(r.scheduledAt) },
    { id: "created", header: "Δημιουργία", width: 140, sortKey: "created", accessor: (r) => r.createdAt, cell: (r) => fmt(r.createdAt) },
  ];

  return (
    <div className="dash-page" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <h1 style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "var(--fs-22)", fontWeight: 700, color: "var(--foreground)", margin: 0 }}><RiFileListLine style={{ color: "var(--color-primary)" }} /> Συμβάσεις έργου</h1>
        <p style={{ margin: "4px 0 0", fontSize: "var(--fs-13)", color: "var(--muted-foreground)" }}>Back-to-back: τι πληρώνει η εταιρεία στον συνεργάτη και τι χρεώνει στον πελάτη. Οι προσφορές στέλνονται από τη σελίδα κάθε βλάβης.</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        {[{ label: "Αναμένουν πελάτη", value: pending }, { label: "Σε εξέλιξη", value: active }, { label: "Αναμένουν παραλαβή", value: awaiting }, { label: "Περιθώριο ενεργών", value: eur(margin) }].map((k) => (
          <div key={k.label} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "14px 16px" }}>
            <div style={{ fontSize: "var(--fs-12)", color: "var(--muted-foreground)" }}>{k.label}</div>
            <div style={{ fontSize: "var(--fs-24)", fontWeight: 700, color: "var(--foreground)" }}>{k.value}</div>
          </div>
        ))}
      </div>
      <DataTable data={items} columns={columns} totalRows={items.length} page={1} pageSize={25} clientSide storageKey="work-orders" searchPlaceholder="Αναζήτηση σύμβασης…"
        getRowActions={(r) => [{ label: "Άνοιγμα βλάβης", icon: <RiEyeLine />, onClick: () => r.maintenanceRequestId && router.push(`/admin/maintenance/${r.maintenanceRequestId}`) }]} />
    </div>
  );
}
