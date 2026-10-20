"use client";

import { useState } from "react";
import { RiRefreshLine, RiLoader4Line, RiBookOpenLine, RiShieldCheckLine } from "react-icons/ri";
import { DataTable, type ColDef } from "@/components/ui/data-table";
import { reindexWiki, type AiActionRow } from "@/app/actions/ai-assistant";
import { TOOL_LABELS } from "@/lib/ai/tools/labels";

const STATUS: Record<string, { label: string; color: string }> = {
  PROPOSED: { label: "Προτάθηκε", color: "#8a5a00" }, EXECUTING: { label: "Εκτελείται", color: "#0078D4" }, EXECUTED: { label: "Εκτελέστηκε", color: "#0f7b3e" },
  FAILED: { label: "Απέτυχε", color: "#a4262c" }, CANCELLED: { label: "Ακυρώθηκε", color: "#707070" }, EXPIRED: { label: "Έληξε", color: "#707070" },
};
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("el-GR", { dateStyle: "short", timeStyle: "short" }) : "—");

/** Super-admin: wiki index status + «Επανευρετηρίαση», and the audit table of assistant actions. */
export function AssistantAdminPanel({ actions, chunkCount, embeddedCount }: { actions: AiActionRow[]; chunkCount: number; embeddedCount: number }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const run = async () => {
    setBusy(true); setResult(null);
    try {
      const r = await reindexWiki();
      setResult(`${r.articles} άρθρα · ${r.chunks} αποσπάσματα · ${r.embedded} ενημερώθηκαν · ${r.deleted} διαγράφηκαν${r.keywordOnly ? " · χωρίς embeddings (αναζήτηση με λέξεις-κλειδιά)" : ""}`);
    } catch (e) { setResult(`Σφάλμα: ${e instanceof Error ? e.message : String(e)}`); }
    finally { setBusy(false); }
  };
  const columns: ColDef<AiActionRow>[] = [
    { id: "createdAt", header: "Ημερομηνία", cell: (r) => when(r.createdAt), accessor: (r) => r.createdAt, sortKey: "createdAt", width: 150 },
    { id: "user", header: "Χρήστης", cell: (r) => <span>{r.userName || r.userEmail}{r.actorId ? <span style={{ color: "var(--muted-foreground)", fontSize: "var(--fs-11)" }}> (View-as)</span> : null}</span>, accessor: (r) => `${r.userName} ${r.userEmail}`, width: 200 },
    { id: "tool", header: "Ενέργεια", cell: (r) => TOOL_LABELS[r.toolName] ?? r.toolName, accessor: (r) => TOOL_LABELS[r.toolName] ?? r.toolName, width: 170 },
    { id: "status", header: "Κατάσταση", cell: (r) => <span style={{ color: STATUS[r.status]?.color ?? "inherit", fontWeight: 600 }}>{STATUS[r.status]?.label ?? r.status}</span>, accessor: (r) => r.status, width: 130 },
    { id: "executedAt", header: "Εκτέλεση", cell: (r) => when(r.executedAt), accessor: (r) => r.executedAt ?? "", width: 150 },
    { id: "error", header: "Σφάλμα", cell: (r) => r.error ?? "", accessor: (r) => r.error ?? "", width: 220 },
  ];
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 24 }}>
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
        <RiBookOpenLine style={{ fontSize: "var(--fs-22)", color: "var(--color-primary)" }} />
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontWeight: 700 }}>Wiki & μνήμη βοηθού (RAG)</div>
          <div style={{ fontSize: "var(--fs-13)", color: "var(--muted-foreground)" }}>{chunkCount} αποσπάσματα στο ευρετήριο · {embeddedCount} με embeddings</div>
          {result && <div style={{ fontSize: "var(--fs-13)", marginTop: 4 }}>{result}</div>}
        </div>
        <button type="button" onClick={run} disabled={busy} style={{ minHeight: 44, padding: "0 16px", borderRadius: 10, border: "none", background: "var(--color-primary)", color: "var(--color-accent)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          {busy ? <RiLoader4Line /> : <RiRefreshLine />} Επανευρετηρίαση wiki
        </button>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700 }}><RiShieldCheckLine /> Ενέργειες βοηθού (audit)</div>
      <DataTable<AiActionRow>
        data={actions} columns={columns} totalRows={actions.length} page={1} pageSize={25} clientSide storageKey="ai-actions" searchPlaceholder="Αναζήτηση ενεργειών…"
        expandedContent={(r) => (
          <div style={{ fontSize: "var(--fs-13)", display: "grid", gap: 6 }}>
            <ul style={{ margin: 0, paddingLeft: 18 }}>{r.summaryLines.map((l, i) => <li key={i}>{l}</li>)}</ul>
            {r.result != null && <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: "var(--fs-12)" }}>{JSON.stringify(r.result, null, 2)}</pre>}
          </div>
        )}
      />
    </section>
  );
}
