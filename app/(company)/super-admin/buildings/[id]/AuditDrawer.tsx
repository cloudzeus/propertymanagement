"use client";

import { useEffect, useState, useTransition } from "react";
import { RiStethoscopeLine, RiCloseLine, RiRefreshLine, RiErrorWarningLine, RiAlertLine, RiInformationLine, RiCheckboxCircleLine } from "react-icons/ri";
import { auditBuildingEntries } from "@/app/actions/building-audit";
import type { Finding, AuditTab } from "@/lib/buildings/audit";

const SEV = {
  error: { color: "#dc2626", icon: RiErrorWarningLine, label: "σφάλματα" },
  warning: { color: "#f59e0b", icon: RiAlertLine, label: "προειδοποιήσεις" },
  info: { color: "#0a8", icon: RiInformationLine, label: "προτάσεις" },
} as const;

export function AuditDrawer({ buildingId, onGoToTab }: { buildingId: string; onGoToTab?: (tab: AuditTab) => void }) {
  const [open, setOpen] = useState(false);
  const [findings, setFindings] = useState<Finding[] | null>(null);
  const [pending, startTransition] = useTransition();

  const run = () => startTransition(async () => setFindings(await auditBuildingEntries(buildingId)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (open && findings === null) run(); }, [open]);

  const counts = (s: keyof typeof SEV) => findings?.filter((f) => f.severity === s).length ?? 0;

  return (
    <>
      <button onClick={() => setOpen(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <RiStethoscopeLine /> Έλεγχος καταχωρήσεων
      </button>
      {open && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50 }}>
          <div onClick={() => setOpen(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.25)" }} />
          <aside style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 380, background: "var(--card, #fff)", borderLeft: "1px solid var(--border)", display: "flex", flexDirection: "column", boxShadow: "-8px 0 24px rgba(0,0,0,.12)" }}>
            <div style={{ padding: 14, borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <b>Έλεγχος καταχωρήσεων</b>
              <button onClick={() => setOpen(false)} aria-label="Κλείσιμο"><RiCloseLine /></button>
            </div>
            <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", display: "flex", gap: 14, fontSize: 12 }}>
              {(Object.keys(SEV) as (keyof typeof SEV)[]).map((s) => (
                <span key={s} style={{ color: SEV[s].color, fontWeight: 700 }}>● {counts(s)} {SEV[s].label}</span>
              ))}
            </div>
            <div style={{ flex: 1, overflowY: "auto", fontSize: 13 }}>
              {pending && <div style={{ padding: 16, color: "#888" }}>Έλεγχος…</div>}
              {!pending && findings && findings.length === 0 && (
                <div style={{ padding: 20, color: "#0a8", display: "flex", gap: 8, alignItems: "center" }}><RiCheckboxCircleLine /> Όλα εντάξει — καμία ένδειξη προβλήματος.</div>
              )}
              {!pending && findings && (["error", "warning", "info"] as const).flatMap((sev) =>
                findings.filter((f) => f.severity === sev).map((f, i) => {
                  const S = SEV[sev];
                  return (
                    <div key={sev + i} style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)" }}>
                      <div style={{ color: S.color, fontWeight: 600, display: "flex", gap: 6, alignItems: "center" }}><S.icon /> {f.title}</div>
                      <div style={{ color: "var(--muted-foreground, #777)", fontSize: 12, margin: "3px 0" }}>{f.detail}</div>
                      {onGoToTab && <button onClick={() => { onGoToTab(f.tab); setOpen(false); }} style={{ color: "#0a7", fontSize: 12, background: "none", border: "none", padding: 0, cursor: "pointer" }}>→ Διόρθωση</button>}
                    </div>
                  );
                }),
              )}
            </div>
            <div style={{ padding: 12, borderTop: "1px solid var(--border)" }}>
              <button onClick={run} disabled={pending} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><RiRefreshLine /> Επανέλεγχος</button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
