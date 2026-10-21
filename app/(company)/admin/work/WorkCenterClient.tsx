"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RiAlarmWarningLine, RiCalendarCheckLine, RiCalendarLine, RiUserUnfollowLine, RiEyeLine, RiArrowRightLine, RiUserAddLine, RiTaskLine, RiCustomerService2Line } from "react-icons/ri";
import { DataTable, type ColDef, type RowAction, type BatchAction } from "@/components/ui/data-table";
import { KpiCard } from "@/components/dashboard/kit";
import { Modal, FieldSelect } from "@/components/ui/modal";
import { SourcePill, StagePill, DuePill } from "@/components/work/pills";
import { applyFilters, computeKpis, serializeFilters, type WorkFilters, type WorkQuickFilter } from "@/lib/work/kpis";
import { STAGE_LABELS, type WorkItem } from "@/lib/work/types";
import type { WorkViewer } from "@/lib/work/scope";
import { STATUS_LABELS, STATUS_TRANSITIONS, PRIORITY_LABELS, type FaultStatus } from "@/lib/maintenance-shared";
import { assignRequest, changeRequestStatus } from "@/app/actions/maintenance-requests";
import { callAction } from "@/lib/work/client-actions";
import { WorkFilterBar } from "./WorkFilterBar";

type Props = {
  items: WorkItem[];
  filters: WorkFilters;
  viewer: WorkViewer;
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
  const [assignTargets, setAssignTargets] = useState<string[] | null>(null); // fault ids awaiting an assignee
  const [assignee, setAssignee] = useState("");
  const [pending, startTransition] = useTransition();

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

  async function run(label: string, fn: () => Promise<{ ok?: boolean; error?: string }>) {
    setMessage(null);
    const res = await callAction(fn);
    if ("error" in res && res.error) { setMessage({ kind: "error", text: res.error }); return false; }
    setMessage({ kind: "ok", text: label });
    startTransition(() => router.refresh());
    return true;
  }

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

  function rowActions(r: WorkItem): RowAction<WorkItem>[] {
    const actions: RowAction<WorkItem>[] = [{ label: "Προβολή", icon: <RiEyeLine />, onClick: () => router.push(r.href) }];
    if (r.source !== "fault") return actions;
    if (viewer.canManage) {
      for (const t of STATUS_TRANSITIONS[r.rawStatus as FaultStatus] ?? []) {
        actions.push({ label: `→ ${STATUS_LABELS[t]}`, icon: <RiArrowRightLine />, danger: t === "CANCELLED",
          onClick: () => run(`Η βλάβη είναι «${STATUS_LABELS[t]}»`, () => changeRequestStatus(faultIdOf(r), t)) });
      }
    }
    if (viewer.canAssign) actions.push({ label: "Ανάθεση σε…", icon: <RiUserAddLine />, onClick: () => { setAssignee(r.assigneeId ?? ""); setAssignTargets([faultIdOf(r)]); } });
    return actions;
  }

  const batchActions: BatchAction<WorkItem>[] = viewer.canAssign ? [
    { label: "Ανάθεση επιλεγμένων", icon: <RiUserAddLine />, onClick: (rows) => {
      const ids = rows.filter((w) => w.source === "fault").map(faultIdOf);
      if (!ids.length) { setMessage({ kind: "error", text: "Η ανάθεση αφορά μόνο βλάβες" }); return; }
      setAssignee(""); setAssignTargets(ids);
    } },
    { label: "→ Σε αξιολόγηση", icon: <RiArrowRightLine />, onClick: async (rows) => {
      const ids = rows.filter((w) => w.source === "fault" && w.rawStatus === "OPEN").map(faultIdOf);
      if (!ids.length) { setMessage({ kind: "error", text: "Καμία «Νέα» βλάβη στην επιλογή" }); return; }
      let failed = 0;
      for (const id of ids) { const r = await callAction(() => changeRequestStatus(id, "ACKNOWLEDGED")); if ("error" in r && r.error) failed++; }
      setMessage(failed ? { kind: "error", text: `Απέτυχε για ${failed} από ${ids.length}` } : { kind: "ok", text: `${ids.length} βλάβες σε αξιολόγηση` });
      startTransition(() => router.refresh());
    } },
  ] : [];

  const kpiCards: { key: WorkQuickFilter; label: string; value: number; sub: string; icon: typeof RiAlarmWarningLine; accent: string }[] = [
    { key: "overdue", label: "Εκπρόθεσμα", value: kpis.overdue, sub: "Πέρασε η προθεσμία / SLA", icon: RiAlarmWarningLine, accent: "#d13438" },
    { key: "today", label: "Σήμερα", value: kpis.today, sub: "Με προθεσμία σήμερα", icon: RiCalendarCheckLine, accent: "var(--color-primary)" },
    { key: "week", label: "Αυτή την εβδομάδα", value: kpis.week, sub: "Δευτέρα–Κυριακή", icon: RiCalendarLine, accent: "#8764B8" },
    { key: "unassigned", label: "Χωρίς ανάθεση", value: kpis.unassigned, sub: "Βλάβες ευθύνης εταιρείας", icon: RiUserUnfollowLine, accent: "#CA5D00" },
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
        <div role="status" style={{ padding: "8px 12px", borderRadius: "var(--radius-sm)", fontSize: "var(--fs-13)", background: message.kind === "ok" ? "#dcfce7" : "#fee2e2", color: message.kind === "ok" ? "#166534" : "#991b1b" }}>
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

      <Modal open={assignTargets !== null} onClose={() => setAssignTargets(null)} title={assignTargets && assignTargets.length > 1 ? `Ανάθεση ${assignTargets.length} βλαβών` : "Ανάθεση βλάβης"} width={420}
        footer={
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" onClick={() => setAssignTargets(null)} style={{ height: 36, padding: "0 14px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "var(--card)", cursor: "pointer", fontFamily: "inherit", fontSize: "var(--fs-13)" }}>Άκυρο</button>
            <button type="button" disabled={pending} onClick={async () => { const ids = assignTargets ?? []; setAssignTargets(null); await assign(ids, assignee || null); }}
              style={{ height: 36, padding: "0 14px", border: "none", borderRadius: "var(--radius-sm)", background: "var(--color-primary)", color: "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: "var(--fs-13)", fontWeight: 600 }}>
              Ανάθεση
            </button>
          </div>
        }>
        <FieldSelect value={assignee} onChange={setAssignee} options={employees.map((e) => ({ value: e.id, label: e.name }))} placeholder="— Χωρίς ανάθεση —" />
        <p style={{ margin: "8px 0 0", fontSize: "var(--fs-12)", color: "var(--muted-foreground)" }}>Ο υπάλληλος ειδοποιείται με email και στο καμπανάκι.</p>
      </Modal>
    </div>
  );
}
