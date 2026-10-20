"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { RiRefreshLine, RiFlaskLine, RiLoader4Line, RiCheckboxCircleLine, RiCloseCircleLine, RiSkipForwardLine, RiHistoryLine, RiSearchLine, RiSendPlaneLine, RiErrorWarningLine } from "react-icons/ri";
import { DataTable, type ColDef } from "@/components/ui/data-table";
import { Modal } from "@/components/ui/modal";
import { pullSoftoneMasterData, searchPushCandidates, dryRunPush, type PushEntityKey } from "@/app/actions/softone";
import type { PullResult } from "@/lib/softone/sync/engine";
import type { PullEntityKey } from "@/lib/softone/sync/core";
import type { MapResult } from "@/lib/softone/mappers";
import { S1_CARD, S1_BTN, S1_INPUT, S1_LABEL, fmtDate } from "./SoftoneHeader";

export type MasterRow = { id: string; s1Key: number; code: string | null; name: string; isActive: boolean; lastSyncedAt: string; extra: Record<string, string | number | boolean | null> };
export type LogRow = { id: string; entity: string; entityId: string; object: string; action: string; direction: string; status: string; softoneKey: number | null; counts: Record<string, number> | null; error: string | null; trigger: string | null; durationMs: number | null; createdAt: string; payload: unknown; response: unknown };
type Status = { key: PullEntityKey; label: string; object: string; description: string; total: number; active: number; lastRunAt: string | null; lastStatus: string | null; lastError: string | null; lastOkAt: string | null; lastCounts: Record<string, number> | null };

const EXTRA_LABELS: Record<string, string> = { percent: "%", myDataCode: "myDATA", shortcut: "Συντ.", qDecimals: "Δεκαδικά", city: "Πόλη", sosource: "Ροή", sosourceLabel: "Ροή", fprms: "FPRMS", tfprms: "TFPRMS", tfprmsName: "Τύπος παραστατικού", branch: "Υποκ/μα", district: "Νομός", country: "Χώρα" };
const PUSH_ENTITIES: { key: PushEntityKey; label: string; object: string }[] = [
  { key: "customer", label: "Πελάτης", object: "CUSTOMER" }, { key: "supplier", label: "Συνεργάτης", object: "SUPPLIER" }, { key: "building", label: "Κτήριο", object: "PRJC" },
  { key: "service", label: "Υπηρεσία", object: "SERVICE" }, { key: "work-order", label: "Σύμβαση έργου", object: "CNTR ×2" }, { key: "property-service", label: "Πακέτο διαχείρισης", object: "CNTR" },
];
const STATUS_ICON: Record<string, { icon: React.ElementType; color: string }> = { OK: { icon: RiCheckboxCircleLine, color: "#2E7D5B" }, ERROR: { icon: RiCloseCircleLine, color: "#C0392B" }, SKIPPED: { icon: RiSkipForwardLine, color: "#CA5D00" }, DRY_RUN: { icon: RiFlaskLine, color: "#0F6CBD" } };

export function SoftoneSyncClient({ configured, status, entity, table, logs }: {
  configured: boolean; status: Status[]; entity: PullEntityKey;
  table: { rows: MasterRow[]; total: number; page: number; pageSize: number; search: string; sortBy: string; sortDir: "asc" | "desc" };
  logs: LogRow[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [, start] = useTransition();
  const [result, setResult] = useState<{ title: string; dryRun: boolean; skipped?: string; results: PullResult[] } | null>(null);
  const [confirm, setConfirm] = useState<{ key: PullEntityKey | "all"; label: string } | null>(null);
  const cur = status.find((s) => s.key === entity)!;

  function run(key: PullEntityKey | "all", dryRun: boolean, label: string) {
    setBusy(`${key}:${dryRun}`); setConfirm(null);
    start(async () => {
      try {
        const r = await pullSoftoneMasterData(key, dryRun);
        setResult({ title: `${dryRun ? "Dry-run" : "Συγχρονισμός"} — ${label}`, dryRun, ...r });
      } catch (e) {
        setResult({ title: label, dryRun, skipped: e instanceof Error ? e.message : String(e), results: [] });
      }
      setBusy(null);
      if (!dryRun) router.refresh();
    });
  }

  const extraKeys = Object.keys(table.rows[0]?.extra ?? {});
  const columns: ColDef<MasterRow>[] = [
    { id: "s1Key", header: "S1 id", sortKey: "s1Key", width: 90, cell: (r) => <span style={{ fontFamily: "monospace" }}>{r.s1Key}</span> },
    { id: "code", header: "Κωδικός", sortKey: "code", width: 120, cell: (r) => r.code ?? "—" },
    { id: "name", header: "Όνομα", sortKey: "name", width: 260, cell: (r) => r.name },
    ...extraKeys.filter((k) => !["sosource"].includes(k)).map((k): ColDef<MasterRow> => ({ id: k, header: EXTRA_LABELS[k] ?? k, width: 120, cell: (r) => { const v = r.extra[k]; return v == null || v === "" ? "—" : String(v); } })),
    { id: "isActive", header: "Ενεργό", sortKey: "isActive", width: 90, cell: (r) => <span style={{ color: r.isActive ? "#2E7D5B" : "#C0392B", fontWeight: 600 }}>{r.isActive ? "Ναι" : "Όχι"}</span> },
    { id: "lastSyncedAt", header: "Συγχρονίστηκε", sortKey: "lastSyncedAt", width: 150, cell: (r) => fmtDate(r.lastSyncedAt) },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {!configured && <div style={{ padding: "10px 14px", borderRadius: 8, background: "#CA5D0014", border: "1px solid #CA5D0040", color: "#CA5D00", fontSize: "var(--fs-12-5)" }}>Η σύνδεση SoftOne δεν είναι ενεργή — ο συγχρονισμός και το dry-run απαιτούν ενεργή σύνδεση (καρτέλα «Σύνδεση»).</div>}

      {/* Entity cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 10 }}>
        {status.map((s) => {
          const on = s.key === entity;
          const SI = s.lastStatus ? STATUS_ICON[s.lastStatus] : null;
          return (
            <button key={s.key} type="button" onClick={() => router.push(`/super-admin/settings/softone/sync?e=${s.key}`)} style={{ textAlign: "left", cursor: "pointer", padding: "12px 14px", borderRadius: "var(--radius-lg)", border: `1px solid ${on ? "var(--color-primary)" : "var(--border)"}`, background: on ? "var(--color-primary)10" : "var(--card)", color: "var(--foreground)", fontFamily: "inherit", minHeight: 44 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: "var(--fs-13-5)" }}>{s.label}<span style={{ marginLeft: "auto", fontSize: "var(--fs-11)", color: "var(--muted-foreground)", fontFamily: "monospace" }}>{s.object}</span></div>
              <div style={{ fontSize: "var(--fs-12)", color: "var(--muted-foreground)", marginTop: 4 }}>{s.active} ενεργά / {s.total} σύνολο</div>
              <div style={{ fontSize: "var(--fs-11)", color: "var(--muted-foreground)", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
                {SI && <SI.icon style={{ color: SI.color }} />} {s.lastRunAt ? fmtDate(s.lastRunAt) : "δεν έχει τρέξει"}
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected entity */}
      <div style={S1_CARD}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <h2 style={{ fontSize: "var(--fs-15)", fontWeight: 600, margin: 0 }}>{cur.label} <span style={{ fontFamily: "monospace", fontWeight: 400, color: "var(--muted-foreground)" }}>({cur.object})</span></h2>
            <p style={{ fontSize: "var(--fs-12-5)", color: "var(--muted-foreground)", margin: "4px 0 0" }}>{cur.description}</p>
            {cur.lastCounts && <p style={{ fontSize: "var(--fs-12)", color: "var(--muted-foreground)", margin: "6px 0 0" }}>Τελευταίος επιτυχής {fmtDate(cur.lastOkAt)}: {cur.lastCounts.fetched} από SoftOne · +{cur.lastCounts.inserted} νέα · {cur.lastCounts.updated} ενημερώσεις · {cur.lastCounts.deactivated} απενεργοποιήσεις</p>}
            {cur.lastStatus === "ERROR" && cur.lastError && <p style={{ fontSize: "var(--fs-12)", color: "#C0392B", margin: "6px 0 0" }}>Τελευταίο σφάλμα: {cur.lastError}</p>}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" disabled={!configured || !!busy} onClick={() => run(entity, true, cur.label)} style={S1_BTN("ghost", !configured || !!busy)}>
              {busy === `${entity}:true` ? <RiLoader4Line style={{ animation: "s1spin 1s linear infinite" }} /> : <RiFlaskLine />} Dry-run
            </button>
            <button type="button" disabled={!configured || !!busy} onClick={() => setConfirm({ key: entity, label: cur.label })} style={S1_BTN("primary", !configured || !!busy)}>
              {busy === `${entity}:false` ? <RiLoader4Line style={{ animation: "s1spin 1s linear infinite" }} /> : <RiRefreshLine />} Συγχρονισμός τώρα
            </button>
            <button type="button" disabled={!configured || !!busy} onClick={() => setConfirm({ key: "all", label: "όλες οι οντότητες" })} style={S1_BTN("ghost", !configured || !!busy)} title="Με τη σειρά: ΦΠΑ → μονάδες → ΔΟΥ → σειρές → νομοί → ΤΚ">
              {busy === "all:false" ? <RiLoader4Line style={{ animation: "s1spin 1s linear infinite" }} /> : <RiRefreshLine />} Όλα
            </button>
          </div>
        </div>
        <DataTable<MasterRow>
          data={table.rows} columns={columns} totalRows={table.total} page={table.page} pageSize={table.pageSize}
          searchQuery={table.search} sortBy={table.sortBy} sortDir={table.sortDir} storageKey={`softone-master-${entity}`} searchPlaceholder="Αναζήτηση σε κωδικό / όνομα…"
          expandedContent={(r) => <pre style={{ margin: 0, fontSize: "var(--fs-11)", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{JSON.stringify(r.extra, null, 2)}</pre>}
        />
      </div>

      <PushDryRun configured={configured} />

      {/* History */}
      <div style={S1_CARD}>
        <h2 style={{ fontSize: "var(--fs-15)", fontWeight: 600, margin: 0, display: "flex", alignItems: "center", gap: 8 }}><RiHistoryLine /> Ιστορικό συγχρονισμού</h2>
        <DataTable<LogRow>
          clientSide data={logs} totalRows={logs.length} page={1} pageSize={10} storageKey="softone-sync-log" searchPlaceholder="Αναζήτηση…"
          columns={[
            { id: "createdAt", header: "Ημερομηνία", sortKey: "createdAt", width: 150, accessor: (r) => r.createdAt, cell: (r) => fmtDate(r.createdAt) },
            { id: "direction", header: "Κατεύθυνση", sortKey: "direction", width: 110, accessor: (r) => r.direction, cell: (r) => r.direction === "PULL" ? "SoftOne → Orithon" : "Orithon → SoftOne" },
            { id: "entity", header: "Οντότητα", sortKey: "entity", width: 120, accessor: (r) => r.entity, cell: (r) => r.entity },
            { id: "object", header: "Αντικείμενο", sortKey: "object", width: 110, accessor: (r) => r.object, cell: (r) => <span style={{ fontFamily: "monospace" }}>{r.object}</span> },
            { id: "action", header: "Ενέργεια", width: 90, accessor: (r) => r.action, cell: (r) => r.action },
            { id: "status", header: "Κατάσταση", sortKey: "status", width: 110, accessor: (r) => r.status, cell: (r) => { const S = STATUS_ICON[r.status]; return <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: S?.color, fontWeight: 600 }}>{S && <S.icon />} {r.status}</span>; } },
            { id: "counts", header: "Πλήθη / μήνυμα", width: 320, accessor: (r) => r.error ?? "", cell: (r) => r.error ? <span style={{ color: "#C0392B" }}>{r.error.split("\n")[0].slice(0, 160)}</span> : r.counts ? <span style={{ color: "var(--muted-foreground)" }}>{r.counts.fetched} ληφθέντα · +{r.counts.inserted} · ~{r.counts.updated} · −{r.counts.deactivated}</span> : "—" },
            { id: "softoneKey", header: "S1 key", width: 80, accessor: (r) => r.softoneKey ?? "", cell: (r) => r.softoneKey ?? "—" },
            { id: "trigger", header: "Έναυσμα", width: 90, defaultVisible: false, accessor: (r) => r.trigger ?? "", cell: (r) => r.trigger === "scheduler" ? "αυτόματα" : r.trigger === "manual" ? "χειροκίνητα" : (r.trigger ?? "—") },
            { id: "durationMs", header: "Διάρκεια", width: 90, defaultVisible: false, accessor: (r) => r.durationMs ?? 0, cell: (r) => r.durationMs != null ? `${(r.durationMs / 1000).toFixed(1)}s` : "—" },
          ]}
          expandedContent={(r) => <pre style={{ margin: 0, fontSize: "var(--fs-11)", whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: 320, overflow: "auto" }}>{JSON.stringify({ counts: r.counts, error: r.error, payload: r.payload, response: r.response }, null, 2)}</pre>}
        />
      </div>

      {/* Confirm real sync */}
      <Modal open={!!confirm} onClose={() => setConfirm(null)} title="Συγχρονισμός από το SoftOne" width={520}
        footer={<div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><button type="button" onClick={() => setConfirm(null)} style={S1_BTN("ghost")}>Άκυρο</button><button type="button" onClick={() => confirm && run(confirm.key, false, confirm.label)} style={S1_BTN("primary")}><RiRefreshLine /> Εκτέλεση</button></div>}>
        <p style={{ margin: 0, fontSize: "var(--fs-13)", lineHeight: 1.6 }}>
          Θα διαβαστούν από το SoftOne <strong>{confirm?.label}</strong> και θα ενημερωθεί ο τοπικός πίνακας: νέες εγγραφές προστίθενται, αλλαγμένες ενημερώνονται, όσες δεν επιστρέφονται πλέον <strong>απενεργοποιούνται</strong> (ποτέ διαγραφή). Δεν γράφεται τίποτα στο SoftOne. Θέλετε να δείτε πρώτα το dry-run;
        </p>
      </Modal>

      {/* Result modal */}
      <Modal open={!!result} onClose={() => setResult(null)} title={result?.title ?? ""} width={760}>
        {result?.skipped && <div style={{ display: "flex", gap: 8, alignItems: "flex-start", color: "#CA5D00", fontSize: "var(--fs-13)" }}><RiErrorWarningLine style={{ marginTop: 2 }} /> {result.skipped}</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, maxHeight: "65vh", overflow: "auto" }}>
          {result?.results.map((r) => (
            <div key={r.entity} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12, fontSize: "var(--fs-12-5)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
                {r.ok ? <RiCheckboxCircleLine style={{ color: "#2E7D5B" }} /> : <RiCloseCircleLine style={{ color: "#C0392B" }} />} {r.label} <span style={{ fontFamily: "monospace", fontWeight: 400, color: "var(--muted-foreground)" }}>{r.object}</span>
                <span style={{ marginLeft: "auto", color: "var(--muted-foreground)", fontWeight: 400 }}>{(r.durationMs / 1000).toFixed(1)}s{r.dryRun ? " · dry-run (χωρίς εγγραφή)" : ""}</span>
              </div>
              {r.error ? <div style={{ color: "#C0392B", marginTop: 6 }}>{r.error}</div> : (
                <>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                    {[["Από SoftOne", r.counts.fetched, "#5C5C5C"], ["Νέα", r.counts.inserted, "#2E7D5B"], ["Ενημερώσεις", r.counts.updated, "#0F6CBD"], ["Αμετάβλητα", r.counts.unchanged, "#5C5C5C"], ["Απενεργοποιήσεις", r.counts.deactivated, "#CA5D00"], ["Χωρίς κλειδί", r.counts.skipped, "#C0392B"]].map(([l, n, c]) => (
                      <span key={String(l)} style={{ padding: "3px 10px", borderRadius: 999, background: `${c}14`, color: String(c), fontWeight: 600 }}>{l}: {n}</span>
                    ))}
                  </div>
                  {r.missingFields.length > 0 && <div style={{ color: "#CA5D00", marginTop: 6 }}>Στήλες που δεν επέστρεψε η λίστα του SoftOne: {r.missingFields.join(", ")} (διαθέσιμες: {r.fields.join(", ")})</div>}
                  <PreviewList title="Νέα" items={r.preview.inserted} color="#2E7D5B" />
                  <PreviewList title="Ενημερώσεις" items={r.preview.updated} color="#0F6CBD" />
                  <PreviewList title="Απενεργοποιήσεις" items={r.preview.deactivated} color="#CA5D00" />
                </>
              )}
            </div>
          ))}
        </div>
      </Modal>
      <style>{`@keyframes s1spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function PreviewList({ title, items, color }: { title: string; items: { s1Key: number; code: string | null; name: string; changes?: Record<string, { from: unknown; to: unknown }> }[]; color: string }) {
  if (!items.length) return null;
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontWeight: 600, color, marginBottom: 4 }}>{title} (πρώτα {items.length})</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {items.map((i) => (
          <div key={i.s1Key} style={{ padding: "4px 8px", background: "var(--paper)", borderRadius: 6 }}>
            <span style={{ fontFamily: "monospace" }}>{i.s1Key}</span> {i.code ? `${i.code} · ` : ""}{i.name}
            {i.changes && <span style={{ color: "var(--muted-foreground)" }}> — {Object.entries(i.changes).map(([k, c]) => `${k}: ${String(c.from ?? "—")} → ${String(c.to ?? "—")}`).join(", ")}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function PushDryRun({ configured }: { configured: boolean }) {
  const [entity, setEntity] = useState<PushEntityKey>("customer");
  const [q, setQ] = useState("");
  const [cands, setCands] = useState<{ id: string; label: string; linked: boolean }[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [res, setRes] = useState<{ ok: true; results: MapResult[] } | { ok: false; error: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => { try { const c = await searchPushCandidates(entity, q); if (alive) setCands(c); } catch { if (alive) setCands([]); } }, 300);
    return () => { alive = false; clearTimeout(t); };
  }, [entity, q]);

  async function preview(id: string) {
    setPicked(id); setLoading(true); setRes(null);
    try { setRes(await dryRunPush(entity, id)); } catch (e) { setRes({ ok: false, error: e instanceof Error ? e.message : String(e) }); }
    setLoading(false);
  }

  return (
    <div style={S1_CARD}>
      <div>
        <h2 style={{ fontSize: "var(--fs-15)", fontWeight: 600, margin: 0, display: "flex", alignItems: "center", gap: 8 }}><RiSendPlaneLine /> Προεπισκόπηση αποστολής (Orithon → SoftOne)</h2>
        <p style={{ fontSize: "var(--fs-12-5)", color: "var(--muted-foreground)", margin: "4px 0 0" }}>
          Dry-run μόνο: δείχνει το ακριβές JSON του setData που θα στελνόταν για μια εγγραφή, τα προαπαιτούμενα που λείπουν και τις παραμέτρους που δεν έχουν οριστεί. <strong>Δεν καλεί το SoftOne και δεν καταγράφει τίποτα</strong> — ο μηχανισμός αποστολής ενεργοποιείται μετά τη συμφωνία της προδιαγραφής.
        </p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 1fr) minmax(260px, 2fr)", gap: 14 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <label style={S1_LABEL}>Οντότητα</label>
            <select value={entity} onChange={(e) => { setEntity(e.target.value as PushEntityKey); setPicked(null); setRes(null); }} style={S1_INPUT}>
              {PUSH_ENTITIES.map((p) => <option key={p.key} value={p.key}>{p.label} → {p.object}</option>)}
            </select>
          </div>
          <div>
            <label style={S1_LABEL}>Εγγραφή</label>
            <div style={{ position: "relative" }}>
              <RiSearchLine style={{ position: "absolute", left: 10, top: 12, color: "var(--muted-foreground)" }} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Αναζήτηση με όνομα…" style={{ ...S1_INPUT, paddingLeft: 30 }} />
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3, maxHeight: 300, overflow: "auto" }}>
            {cands.map((c) => (
              <button key={c.id} type="button" onClick={() => preview(c.id)} style={{ textAlign: "left", padding: "8px 10px", borderRadius: 6, border: `1px solid ${picked === c.id ? "var(--color-primary)" : "var(--border)"}`, background: picked === c.id ? "var(--color-primary)10" : "var(--paper)", cursor: "pointer", fontSize: "var(--fs-12-5)", color: "var(--foreground)", fontFamily: "inherit", display: "flex", gap: 8, alignItems: "center", minHeight: 36 }}>
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.label}</span>
                <span style={{ fontSize: "var(--fs-11)", color: c.linked ? "#2E7D5B" : "var(--muted-foreground)" }}>{c.linked ? "συνδεδεμένο" : "νέο"}</span>
              </button>
            ))}
            {cands.length === 0 && <div style={{ fontSize: "var(--fs-12)", color: "var(--muted-foreground)" }}>Καμία εγγραφή.</div>}
          </div>
        </div>
        <div style={{ minWidth: 0 }}>
          {loading && <div style={{ fontSize: "var(--fs-12-5)", color: "var(--muted-foreground)" }}><RiLoader4Line style={{ animation: "s1spin 1s linear infinite" }} /> Υπολογισμός…</div>}
          {res && !res.ok && <div style={{ color: "#C0392B", fontSize: "var(--fs-12-5)" }}>{res.error}</div>}
          {res && res.ok && res.results.map((m, i) => (
            <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12, marginBottom: 10, fontSize: "var(--fs-12-5)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <strong>setData {m.object}</strong>
                <span style={{ padding: "2px 8px", borderRadius: 999, background: m.action === "insert" ? "#2E7D5B14" : "#0F6CBD14", color: m.action === "insert" ? "#2E7D5B" : "#0F6CBD", fontWeight: 600 }}>{m.action === "insert" ? "εισαγωγή" : `ενημέρωση · key ${m.key}`}</span>
                <span style={{ marginLeft: "auto", padding: "2px 8px", borderRadius: 999, background: m.missing.length ? "#C0392B14" : "#2E7D5B14", color: m.missing.length ? "#C0392B" : "#2E7D5B", fontWeight: 600 }}>{m.missing.length ? `${m.missing.length} εκκρεμότητες` : "έτοιμο"}</span>
              </div>
              {m.missing.length > 0 && <ul style={{ margin: "8px 0 0", paddingLeft: 18, color: "#C0392B" }}>{m.missing.map((x) => <li key={x}>{x}</li>)}</ul>}
              {m.notes.length > 0 && <ul style={{ margin: "8px 0 0", paddingLeft: 18, color: "var(--muted-foreground)" }}>{m.notes.map((x) => <li key={x}>{x}</li>)}</ul>}
              <pre style={{ margin: "8px 0 0", padding: 10, background: "var(--paper)", borderRadius: 8, fontSize: "var(--fs-11)", whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: 360, overflow: "auto" }}>{JSON.stringify({ service: "setData", OBJECT: m.object, ...(m.key != null ? { KEY: String(m.key) } : {}), data: m.data }, null, 2)}</pre>
            </div>
          ))}
          {!res && !loading && <div style={{ fontSize: "var(--fs-12-5)", color: "var(--muted-foreground)" }}>Επιλέξτε μια εγγραφή για να δείτε τι θα στελνόταν.{!configured && " Η προεπισκόπηση δουλεύει και χωρίς ενεργή σύνδεση."}</div>}
        </div>
      </div>
    </div>
  );
}
