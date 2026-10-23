"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RiAlarmWarningLine, RiCalendarCheckLine, RiCalendarLine, RiUserUnfollowLine, RiEyeLine, RiTaskLine, RiCustomerService2Line } from "react-icons/ri";
import { DataTable, type ColDef, type RowAction } from "@/components/ui/data-table";
import { KpiCard } from "@/components/dashboard/kit";
import { SourcePill, StagePill, DuePill } from "@/components/work/pills";
import { useWorkActions } from "@/components/work/useWorkActions";
import { applyFilters, computeKpis, serializeFilters, type WorkFilters, type WorkQuickFilter } from "@/lib/work/kpis";
import { STAGE_LABELS, type WorkItem } from "@/lib/work/types";
import type { WorkActionViewer } from "@/lib/work/scope";
import { EMPTY_FLAGS } from "@/lib/work/actions";
import { subjectFromWorkItem } from "@/lib/work/subjects";
import { PRIORITY_LABELS } from "@/lib/maintenance-shared";
import { assignRequest } from "@/app/actions/maintenance-requests";
import { callAction } from "@/lib/work/client-actions";
import { WorkFilterBar } from "./WorkFilterBar";

type Props = {
  items: WorkItem[];
  filters: WorkFilters;
  viewer: WorkActionViewer;
  employees: { id: string; name: string }[];
  buildings: { id: string; name: string }[];
  supportCount: number;
  nowIso: string;
};

const fmt = (iso: string) => new Date(iso).toLocaleString("el-GR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Athens" });

export function WorkCenterClient({ items, filters: initial, viewer, employees, buildings, supportCount, nowIso }: Props) {
  const router = useRouter();
  const [filters, setFilters] = useState<WorkFilters>(initial);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const wa = useWorkActions({ viewer, where: "list" });

  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const kpis = useMemo(() => computeKpis(items, now), [items, now]);
  const visible = useMemo(() => applyFilters(items, filters, { now, userId: viewer.id }), [items, filters, now, viewer.id]);

  function update(next: WorkFilters) {
    setFilters(next);
    let qs = serializeFilters(next);
    // An EMPLOYEE starts on «Οι εργασίες μου»; switching it off must survive the URL round-trip.
    if (viewer.defaultMine && !next.mine) qs = qs ? `${qs}&mine=0` : "mine=0";
    router.replace(qs ? `/admin/work?${qs}` : "/admin/work");
  }
  const quick = (f: WorkQuickFilter) => update({ ...filters, f: filters.f === f ? undefined : f });

  async function assign(faultIds: string[], userId: string | null) {
    let failed = 0;
    for (const id of faultIds) { const r = await callAction(() => assignRequest(id, userId)); if ("error" in r && r.error) failed++; }
    if (failed) setMessage({ kind: "error", text: `Η ανάθεση απέτυχε για ${failed} από ${faultIds.length}` });
    else setMessage({ kind: "ok", text: userId ? `Ανατέθηκε (${faultIds.length})` : "Η ανάθεση αφαιρέθηκε" });
    startTransition(() => router.refresh());
  }

  const faultIdOf = (w: WorkItem) => w.sourceId;

  const columns: ColDef<WorkItem>[] = [
    { id: "source", header: "Τύπος", width: 130, accessor: (r) => r.source, sortKey: "source", cell: (r) => <SourcePill source={r.source} /> },
    { id: "title", header: "Τίτλος", width: 260, accessor: (r) => r.title, sortKey: "title",
      cell: (r) => (
        <div style={{ minWidth: 0 }}>
          <Link href={r.href} style={{ fontWeight: 600, color: "var(--foreground)", textDecoration: "none" }}>{r.title}</Link>
          {r.subtitle && <div style={{ fontSize: "var(--fs-11-5)", color: "var(--muted-foreground)" }}>{r.subtitle}</div>}
        </div>
      ) },
    { id: "building", header: "Κτήριο", width: 170, accessor: (r) => r.buildingName, sortKey: "buildingName",
      cell: (r) => <><div>{r.buildingName}</div>{r.customerName && <div style={{ fontSize: "var(--fs-11-5)", color: "var(--muted-foreground)" }}>{r.customerName}</div>}</> },
    { id: "stage", header: "Στάδιο", width: 150, accessor: (r) => STAGE_LABELS[r.stage], sortKey: "stage", cell: (r) => <StagePill stage={r.stage} /> },
    { id: "priority", header: "Προτεραιότητα", width: 110, accessor: (r) => r.priority ?? "", cell: (r) => (r.priority ? PRIORITY_LABELS[r.priority] : "—") },
    { id: "due", header: "Προθεσμία", width: 170, accessor: (r) => r.dueAt ?? "", sortKey: "dueAt", cell: (r) => <DuePill dueAt={r.dueAt} overdue={r.overdue} /> },
    { id: "assignee", header: "Ανάθεση", width: 160, accessor: (r) => r.assigneeName ?? "",
      cell: (r) => {
        if (r.source !== "fault" || !viewer.canAssign) return r.assigneeName ?? "—";
        return (
          <select aria-label="Ανάθεση" value={r.assigneeId ?? ""} disabled={pending} onChange={(e) => assign([faultIdOf(r)], e.target.value || null)}
            style={{ height: 28, padding: "0 6px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", fontSize: "var(--fs-12)", background: "var(--card)", color: "var(--foreground)", maxWidth: 150 }}>
            <option value="">— Χωρίς —</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        );
      } },
    { id: "supplier", header: "Συνεργάτης", width: 150, accessor: (r) => r.supplierName ?? "", cell: (r) => r.supplierName ?? "—" },
    { id: "updated", header: "Ενημερώθηκε", width: 140, defaultVisible: false, accessor: (r) => r.updatedAt, sortKey: "updatedAt", cell: (r) => fmt(r.updatedAt) },
  ];

  /** Programme/appointment rows have no action subject: keep a plain «Προβολή» (+ «Ραντεβού…» on appointments). */
  function fallbackFor(r: WorkItem): RowAction<WorkItem>[] {
    const view: RowAction<WorkItem> = { label: r.source === "appointment" ? "Άνοιγμα βλάβης" : "Προβολή", icon: <RiEyeLine />, section: "navigate", onClick: () => router.push(r.href) };
    if (r.source !== "appointment") return [view];
    const faultSubject = { kind: "fault" as const, id: r.sourceId, status: "SCHEDULED", handledBy: "COMPANY" as const, assigneeId: r.assigneeId, supplierId: null, flags: EMPTY_FLAGS };
    return [{ label: "Ραντεβού…", icon: <RiCalendarCheckLine />, section: "schedule", primary: true, onClick: () => wa.open("appointment", faultSubject) }, view];
  }
  const rowActions = (r: WorkItem) => wa.rowActions(subjectFromWorkItem(r), fallbackFor(r));
  const batchActions = wa.batchActions<WorkItem>((rows) => rows.map(subjectFromWorkItem));

  const kpiCards: { key: WorkQuickFilter; label: string; value: number; sub: string; icon: typeof RiAlarmWarningLine; accent: string }[] = [
    { key: "overdue", label: "Εκπρόθεσμα", value: kpis.overdue, sub: "Πέρασε η προθεσμία / SLA", icon: RiAlarmWarningLine, accent: "var(--color-danger)" },
    { key: "today", label: "Σήμερα", value: kpis.today, sub: "Με προθεσμία σήμερα", icon: RiCalendarCheckLine, accent: "var(--color-primary)" },
    { key: "week", label: "Αυτή την εβδομάδα", value: kpis.week, sub: "Δευτέρα–Κυριακή", icon: RiCalendarLine, accent: "var(--color-purple)" },
    { key: "unassigned", label: "Χωρίς ανάθεση", value: kpis.unassigned, sub: "Βλάβες ευθύνης εταιρείας", icon: RiUserUnfollowLine, accent: "var(--color-warning)" },
  ];

  return (
    <div className="dash-page" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <h1 style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "var(--fs-22)", fontWeight: 700, color: "var(--foreground)", margin: 0 }}>
            <RiTaskLine style={{ color: "var(--color-primary)" }} /> Κέντρο εργασιών
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: "var(--fs-13)", color: "var(--muted-foreground)" }}>
            {visible.length} από {items.length} εκκρεμείς εργασίες — βλάβες, συμβάσεις έργου, αιτήματα προσφοράς, πρόγραμμα συντηρήσεων, ραντεβού.
          </p>
        </div>
        {supportCount > 0 && (
          <Link href="/staff/support" style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 36, padding: "0 12px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", fontSize: "var(--fs-13)", color: "var(--foreground)", textDecoration: "none", background: "var(--card)" }}>
            <RiCustomerService2Line /> Tickets υποστήριξης ({supportCount})
          </Link>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        {kpiCards.map((k) => (
          <div key={k.key} role="button" tabIndex={0} aria-pressed={filters.f === k.key} onClick={() => quick(k.key)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); quick(k.key); } }}
            style={{ cursor: "pointer", borderRadius: "var(--radius)", outline: filters.f === k.key ? "2px solid var(--color-primary)" : "none", outlineOffset: 2 }}>
            <KpiCard label={k.label} value={k.value} sub={k.sub} icon={k.icon} accent={k.accent} />
          </div>
        ))}
      </div>

      <WorkFilterBar filters={filters} onChange={update} buildings={buildings} employees={employees} showMine={viewer.canManage} />

      {message && (
        <div role="status" style={{ padding: "8px 12px", borderRadius: "var(--radius-sm)", fontSize: "var(--fs-13)", background: message.kind === "ok" ? "var(--success-soft)" : "var(--danger-soft)", color: message.kind === "ok" ? "var(--color-success)" : "var(--color-danger)" }}>
          {message.text}
        </div>
      )}

      <DataTable
        data={visible}
        columns={columns}
        totalRows={visible.length}
        page={1}
        pageSize={25}
        clientSide
        storageKey="work-center"
        searchPlaceholder="Αναζήτηση εργασίας…"
        getRowActions={rowActions}
        batchActions={batchActions.length ? batchActions : undefined}
        expandedContent={(r) => (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "var(--fs-13)", color: "var(--foreground)" }}>
            {r.description ? <div style={{ whiteSpace: "pre-wrap" }}>{r.description}</div> : <div style={{ color: "var(--muted-foreground)" }}>Χωρίς περιγραφή</div>}
            <div style={{ fontSize: "var(--fs-12)", color: "var(--muted-foreground)" }}>
              Κατάσταση: {STAGE_LABELS[r.stage]} ({r.rawStatus}) · Τελευταία ενημέρωση: {fmt(r.updatedAt)}
              {r.supplierName ? ` · Συνεργάτης: ${r.supplierName}` : ""}
            </div>
            <Link href={r.href} style={{ fontSize: "var(--fs-12-5)", fontWeight: 600, color: "var(--color-primary)", textDecoration: "none" }}>Άνοιγμα →</Link>
          </div>
        )}
      />

      {wa.host}
    </div>
  );
}
