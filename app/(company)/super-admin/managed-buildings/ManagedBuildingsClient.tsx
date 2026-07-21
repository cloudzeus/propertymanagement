"use client";

import { useMemo } from "react";
import Link from "next/link";
import { DataTable, type ColDef } from "@/components/ui/data-table";
import {
  RiBuilding2Line, RiToolsLine, RiStackLine, RiAlarmWarningLine, RiCalendarCheckLine, RiExternalLinkLine,
} from "react-icons/ri";
import type { ManagedBuildingRow, ObligationRow, RecentLogRow, ObligationStatus } from "@/lib/dashboard/managed-buildings";

const STATUS_STYLE: Record<ObligationStatus, { label: string; bg: string; fg: string }> = {
  overdue: { label: "Εκπρόθεσμη", bg: "#FBE4E4", fg: "#9A2B2B" },
  "due-soon": { label: "Επικείμενη", bg: "#FDF1DF", fg: "#9A5B00" },
  scheduled: { label: "Προγραμματισμένη", bg: "#E4F0EA", fg: "#22604A" },
  none: { label: "—", bg: "#F0F0EE", fg: "#8a8a85" },
};

function fmtDate(iso: string | null) { return iso ? new Date(iso).toLocaleDateString("el-GR") : "—"; }

function StatusPill({ status }: { status: ObligationStatus }) {
  const s = STATUS_STYLE[status];
  return <span style={{ display: "inline-flex", alignItems: "center", fontSize: 11.5, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: s.bg, color: s.fg, whiteSpace: "nowrap" }}>{s.label}</span>;
}

export function ManagedBuildingsClient({ buildings, obligations, recent }: { buildings: ManagedBuildingRow[]; obligations: ObligationRow[]; recent: RecentLogRow[] }) {
  const overdue = useMemo(() => obligations.filter((o) => o.status === "overdue"), [obligations]);
  const dueSoon = useMemo(() => obligations.filter((o) => o.status === "due-soon"), [obligations]);

  const columns: ColDef<ManagedBuildingRow>[] = [
    { id: "name", header: "Κτήριο", accessor: (b) => b.name, cell: (b) => (
      <div>
        <Link href={`/super-admin/buildings/${b.id}`} style={{ fontWeight: 700, color: "var(--foreground)", textDecoration: "none" }}>{b.name}</Link>
        <div style={{ fontSize: 11.5, color: "var(--muted-foreground)" }}>{b.customerName}{b.address ? ` · ${b.address}` : ""}</div>
      </div>
    ) },
    { id: "items", header: "Στοιχεία", accessor: (b) => b.itemCount, cell: (b) => <span style={{ fontVariantNumeric: "tabular-nums" }}>{b.itemCount} <span style={{ color: "var(--muted-foreground)" }}>({b.totalQuantity} τεμ.)</span></span> },
    { id: "schedules", header: "Προγράμματα", accessor: (b) => b.scheduleCount, cell: (b) => <span style={{ fontVariantNumeric: "tabular-nums" }}>{b.scheduleCount}</span> },
    { id: "next", header: "Επόμενη υποχρέωση", accessor: (b) => b.nextDueDate ?? "", cell: (b) => fmtDate(b.nextDueDate) },
    { id: "overdue", header: "Εκπρόθεσμες", accessor: (b) => b.overdueCount, cell: (b) => b.overdueCount > 0
      ? <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 700, color: "#9A2B2B" }}><RiAlarmWarningLine /> {b.overdueCount}</span>
      : <span style={{ color: "var(--muted-foreground)" }}>0</span> },
  ];

  const renderExpanded = (b: ManagedBuildingRow) => {
    const rows = obligations.filter((o) => o.buildingId === b.id);
    const logs = recent.filter((r) => r.buildingId === b.id).slice(0, 5);
    return (
      <div style={{ padding: "12px 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div>
          <div style={sectionTitle}><RiToolsLine /> Προγράμματα συντήρησης</div>
          {rows.length === 0 ? <div style={muted}>Χωρίς προγράμματα</div> : rows.map((o) => (
            <div key={o.taskId} style={rowLine}>
              <span>{o.title}{o.itemName ? ` · ${o.itemName}` : ""}</span>
              <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 8 }}>{fmtDate(o.nextDueDate)} <StatusPill status={o.status} /></span>
            </div>
          ))}
        </div>
        <div>
          <div style={sectionTitle}><RiCalendarCheckLine /> Πρόσφατο ιστορικό</div>
          {logs.length === 0 ? <div style={muted}>Χωρίς καταχωρήσεις</div> : logs.map((l) => (
            <div key={l.id} style={rowLine}>
              <span>{l.title}</span>
              <span style={{ marginLeft: "auto", color: "var(--muted-foreground)" }}>{fmtDate(l.performedAt)}{l.performedBy ? ` · ${l.performedBy}` : ""}</span>
            </div>
          ))}
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <Link href={`/super-admin/buildings/${b.id}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "var(--color-primary)", textDecoration: "none" }}>
            Άνοιγμα καρτέλας κτηρίου <RiExternalLinkLine />
          </Link>
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: "22px 24px 40px", maxWidth: 1240 }}>
      <header style={{ marginBottom: 18 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-.01em", color: "var(--foreground)", display: "flex", alignItems: "center", gap: 9 }}>
          <RiBuilding2Line /> Διαχειριζόμενα κτήρια
        </h1>
        <p style={{ margin: "4px 0 0", fontSize: 13.5, color: "var(--muted-foreground)" }}>Στοιχεία, προγράμματα συντήρησης και υποχρεώσεις των κτηρίων που διαχειρίζεται η εταιρεία.</p>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, marginBottom: 20 }}>
        <StatCard icon={<RiBuilding2Line />} tint="#3B6BB0" value={buildings.length} label="Κτήρια" />
        <StatCard icon={<RiStackLine />} tint="#2E7D5B" value={buildings.reduce((s, b) => s + b.itemCount, 0)} label="Στοιχεία" />
        <StatCard icon={<RiToolsLine />} tint="#9A5B00" value={dueSoon.length} label="Επικείμενες" />
        <StatCard icon={<RiAlarmWarningLine />} tint="#C0392B" value={overdue.length} label="Εκπρόθεσμες" />
      </div>

      {overdue.length > 0 && (
        <section style={panel}>
          <div style={panelTitle}><RiAlarmWarningLine style={{ color: "#C0392B" }} /> Εκπρόθεσμες υποχρεώσεις</div>
          {overdue.map((o) => <ObligationLine key={o.taskId} o={o} />)}
        </section>
      )}
      {dueSoon.length > 0 && (
        <section style={panel}>
          <div style={panelTitle}><RiToolsLine style={{ color: "#9A5B00" }} /> Επικείμενες υποχρεώσεις</div>
          {dueSoon.map((o) => <ObligationLine key={o.taskId} o={o} />)}
        </section>
      )}

      <DataTable
        data={buildings}
        columns={columns}
        totalRows={buildings.length}
        page={1}
        pageSize={25}
        clientSide
        storageKey="managed-buildings"
        searchPlaceholder="Αναζήτηση κτηρίου…"
        expandedContent={renderExpanded}
      />
    </div>
  );
}

function ObligationLine({ o }: { o: ObligationRow }) {
  return (
    <div style={rowLine}>
      <Link href={`/super-admin/buildings/${o.buildingId}`} style={{ fontWeight: 600, color: "var(--foreground)", textDecoration: "none" }}>{o.buildingName}</Link>
      <span style={{ color: "var(--muted-foreground)" }}>· {o.title}{o.itemName ? ` (${o.itemName})` : ""}</span>
      <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 8 }}>{fmtDate(o.nextDueDate)} <StatusPill status={o.status} /></span>
    </div>
  );
}

function StatCard({ icon, tint, value, label }: { icon: React.ReactNode; tint: string; value: number; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px" }}>
      <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 38, height: 38, borderRadius: 10, background: `${tint}1A`, color: tint, flex: "none" }}>{icon}</span>
      <div>
        <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.1, color: "var(--foreground)", fontVariantNumeric: "tabular-nums" }}>{value}</div>
        <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 1 }}>{label}</div>
      </div>
    </div>
  );
}

const panel: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px", marginBottom: 16 };
const panelTitle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700, color: "var(--foreground)", marginBottom: 10 };
const sectionTitle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 700, color: "var(--foreground)", marginBottom: 8 };
const rowLine: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", fontSize: 13, color: "var(--foreground)", padding: "6px 0", borderTop: "1px solid var(--border)" };
const muted: React.CSSProperties = { fontSize: 12.5, color: "var(--muted-foreground)", padding: "6px 0" };
