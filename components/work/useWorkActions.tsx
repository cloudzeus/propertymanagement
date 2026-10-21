"use client";

/**
 * One hook per page: turns the pure action model into DataTable row/batch
 * actions, menu entries for the «Ενέργειες» button, and owns the dialog host.
 * Render `{wa.host}` once anywhere on the page.
 */
import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { RowAction, BatchAction } from "@/components/ui/data-table";
import type { MenuEntry } from "@/components/ui/action-menu";
import { NOTE_STATUSES, resolveWorkActions, type WorkAction, type WorkDialog, type WorkSubject } from "@/lib/work/actions";
import type { WorkActionViewer } from "@/lib/work/scope";
import type { FaultStatus } from "@/lib/maintenance-shared";
import { STATUS_LABELS } from "@/lib/maintenance-shared";
import { changeRequestStatus } from "@/app/actions/maintenance-requests";
import { callAction } from "@/lib/work/client-actions";
import { WORK_ICONS, FALLBACK_ICON } from "./icons";
import { WorkActionHost, type OpenRequest } from "./WorkActionHost";
import { ActionToast, type ToastMessage } from "./ActionToast";
import { RiArrowRightLine, RiTeamLine, RiUserAddLine } from "react-icons/ri";

export type WorkActionsApi = {
  viewer: WorkActionViewer;
  /** Menu entries for a subject (used by ActionsButton). */
  entries: (subject: WorkSubject) => MenuEntry[];
  /** DataTable row actions; a null subject (programme/appointment rows) gets the fallback. */
  rowActions: <T>(subject: WorkSubject | null, fallback?: RowAction<T>[]) => RowAction<T>[];
  /** DataTable batch actions over fault subjects (lists only). */
  batchActions: <T>(subjectsOf: (rows: T[]) => (WorkSubject | null)[]) => BatchAction<T>[];
  open: (dialog: WorkDialog, subject: WorkSubject, opts?: { status?: FaultStatus; batchIds?: string[] }) => void;
  runStatus: (subject: WorkSubject, status: FaultStatus) => Promise<void>;
  notify: (message: ToastMessage) => void;
  host: React.ReactNode;
};

function iconFor(name: string) {
  const Icon = WORK_ICONS[name] ?? FALLBACK_ICON;
  return <Icon />;
}

export function useWorkActions({ viewer, where }: { viewer: WorkActionViewer; where: "list" | "detail" }): WorkActionsApi {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [request, setRequest] = useState<OpenRequest | null>(null);
  const [message, setMessage] = useState<ToastMessage | null>(null);

  const refresh = useCallback(() => startTransition(() => router.refresh()), [router]);
  const notify = useCallback((m: ToastMessage) => setMessage(m), []);
  const open = useCallback((dialog: WorkDialog, subject: WorkSubject, opts?: { status?: FaultStatus; batchIds?: string[] }) => setRequest({ seq: Date.now(), dialog, subject, ...opts }), []);

  const runStatus = useCallback(async (subject: WorkSubject, status: FaultStatus) => {
    const res = await callAction(() => changeRequestStatus(subject.id, status));
    if ("error" in res && res.error) setMessage({ kind: "error", text: res.error });
    else { setMessage({ kind: "ok", text: `Η κατάσταση άλλαξε σε «${STATUS_LABELS[status]}»` }); refresh(); }
  }, [refresh]);

  const toEntry = useCallback((a: WorkAction, subject: WorkSubject): MenuEntry => ({
    key: a.key, label: a.label, icon: iconFor(a.icon), danger: a.danger, section: a.section, primary: a.primary,
    onPick: () => {
      if (a.kind === "link") router.push(a.href);
      else if (a.kind === "status") { if (NOTE_STATUSES.includes(a.status)) open("status-note", subject, { status: a.status }); else void runStatus(subject, a.status); }
      else open(a.dialog, subject, { status: a.status });
    },
  }), [open, router, runStatus]);

  const entries = useCallback((subject: WorkSubject) => resolveWorkActions(subject, viewer, { where }).map((a) => toEntry(a, subject)), [viewer, where, toEntry]);

  const rowActions = useCallback(<T,>(subject: WorkSubject | null, fallback: RowAction<T>[] = []): RowAction<T>[] => {
    if (!subject) return fallback;
    return entries(subject).map((e) => ({ label: e.label, icon: e.icon, danger: e.danger, section: e.section, primary: e.primary, onClick: () => e.onPick() }));
  }, [entries]);

  const batchActions = useCallback(<T,>(subjectsOf: (rows: T[]) => (WorkSubject | null)[]): BatchAction<T>[] => {
    if (where !== "list") return [];
    const faults = (rows: T[]) => subjectsOf(rows).filter((s): s is Extract<WorkSubject, { kind: "fault" }> => !!s && s.kind === "fault");
    const noFaults = () => setMessage({ kind: "error", text: "Οι μαζικές ενέργειες αφορούν μόνο βλάβες — επιλέξτε τουλάχιστον μία." });
    const out: BatchAction<T>[] = [];
    if (viewer.canAssign) {
      out.push({ label: "Ανάθεση σε υπάλληλο…", icon: <RiUserAddLine />, onClick: (rows) => { const f = faults(rows); if (!f.length) return noFaults(); open("assign-employee", f[0], { batchIds: f.map((s) => s.id) }); } });
      out.push({ label: "Ανάθεση σε συνεργάτη…", icon: <RiTeamLine />, onClick: (rows) => { const f = faults(rows); if (!f.length) return noFaults(); open("assign-supplier", f[0], { batchIds: f.map((s) => s.id) }); } });
    }
    if (viewer.canManage) {
      out.push({ label: "→ Σε αξιολόγηση", icon: <RiArrowRightLine />, onClick: async (rows) => {
        const f = faults(rows);
        if (!f.length) return noFaults();
        const open_ = f.filter((s) => s.status === "OPEN");
        let ok = 0;
        for (const s of open_) { const r = await callAction(() => changeRequestStatus(s.id, "ACKNOWLEDGED")); if (!("error" in r && r.error)) ok++; }
        const skipped = f.length - ok;
        setMessage({ kind: ok ? "ok" : "error", text: skipped ? `Σε αξιολόγηση: ${ok} ενημερώθηκαν · ${skipped} παραλείφθηκαν (δεν ήταν «Νέα»)` : `Σε αξιολόγηση: ${ok} ενημερώθηκαν` });
        if (ok) refresh();
      } });
    }
    return out;
  }, [where, viewer, open, refresh]);

  const host = useMemo(() => (
    <>
      <WorkActionHost request={request} viewer={viewer} onClose={() => setRequest(null)} onDone={(text) => { setRequest(null); setMessage({ kind: "ok", text }); refresh(); }} />
      <ActionToast message={message} onClose={() => setMessage(null)} />
    </>
  ), [request, viewer, message, refresh]);

  return { viewer, entries, rowActions, batchActions, open, runStatus, notify, host };
}
