"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { callAction } from "@/lib/work/client-actions";
import type { WorkSubject } from "@/lib/work/actions";
import type { FaultStatus } from "@/lib/maintenance-shared";
import type { WorkActionContext } from "@/app/actions/work-actions";

export type DialogProps = {
  ctx: WorkActionContext;
  subject: WorkSubject;
  /** status-note: the target status */
  status?: FaultStatus;
  /** batch mode: every fault id the action applies to (subject = the first) */
  batchIds?: string[];
  onDone: (message: string) => void;
  onClose: () => void;
};

type ActionResult = { ok?: boolean; error?: string | null } | { id?: string } | { error?: string | null };

/** Busy/error state + a runner that reports business errors inline and success upwards. */
export function useDialogRun(onDone: (message: string) => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(fn: () => Promise<ActionResult>, success: string | ((r: ActionResult) => string)) {
    setBusy(true); setError(null);
    const res = await callAction(fn);
    setBusy(false);
    if (res && "error" in res && res.error) { setError(res.error); return false; }
    onDone(typeof success === "function" ? success(res) : success);
    return true;
  }
  /** Batch: run per id, report «Ν ενημερώθηκαν · Μ παραλείφθηκαν». */
  async function runMany(ids: string[], fn: (id: string) => Promise<ActionResult>, verb: string) {
    setBusy(true); setError(null);
    let ok = 0; const failed: string[] = [];
    for (const id of ids) {
      const r = await callAction(() => fn(id));
      if (r && "error" in r && r.error) failed.push(r.error); else ok++;
    }
    setBusy(false);
    if (ok === 0) { setError(failed[0] ?? "Η ενέργεια απέτυχε."); return false; }
    onDone(failed.length ? `${verb}: ${ok} ενημερώθηκαν · ${failed.length} παραλείφθηκαν (${failed[0]})` : `${verb}: ${ok} ενημερώθηκαν`);
    return true;
  }
  return { busy, error, setError, run, runMany };
}

export const btn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, minHeight: 36, padding: "0 14px", border: "1px solid var(--border)", background: "var(--paper)", borderRadius: "var(--radius-sm)", fontSize: "var(--fs-13)", fontWeight: 600, cursor: "pointer", color: "var(--foreground)", fontFamily: "inherit" };
export const btnPrimary: React.CSSProperties = { ...btn, background: "var(--primary)", color: "var(--primary-foreground)", border: "none" };
export const btnDanger: React.CSSProperties = { ...btn, background: "var(--destructive)", color: "#fff", border: "none" };
export const muted: React.CSSProperties = { fontSize: "var(--fs-12-5)", color: "var(--muted-foreground)", margin: 0 };
export const checkRow: React.CSSProperties = { display: "flex", alignItems: "flex-start", gap: 8, fontSize: "var(--fs-13)", color: "var(--foreground)", cursor: "pointer" };

export function DialogFrame({ title, width = 520, error, busy, onClose, primary, children }: {
  title: string; width?: number; error: string | null; busy: boolean; onClose: () => void;
  /** Footer primary button; omit for read-only frames. */
  primary?: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean };
  children: React.ReactNode;
}) {
  return (
    <Modal open title={title} width={width} onClose={onClose} footer={
      <>
        {error && <span role="alert" style={{ color: "var(--destructive)", fontSize: "var(--fs-12-5)", marginRight: "auto" }}>{error}</span>}
        <button type="button" style={btn} onClick={onClose} disabled={busy}>Άκυρο</button>
        {primary && (
          <button type="button" style={primary.danger ? btnDanger : btnPrimary} onClick={primary.onClick} disabled={busy || primary.disabled}>
            {busy ? "Παρακαλώ περιμένετε…" : primary.label}
          </button>
        )}
      </>
    }>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{children}</div>
    </Modal>
  );
}

export const fmt = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString("el-GR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Athens" }) : "—");
