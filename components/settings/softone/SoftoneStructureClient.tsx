"use client";

import { useState, useTransition } from "react";
import { RiCheckboxCircleLine, RiCloseCircleLine, RiErrorWarningLine, RiLoader4Line, RiPlayLine, RiArrowDownSLine, RiArrowRightSLine, RiSkipForwardLine } from "react-icons/ri";
import { runSoftoneReadinessChecks } from "@/app/actions/softone";
import type { CheckResult } from "@/lib/softone/checks";
import type { EntityMap } from "@/lib/softone/mapping";
import { S1_CARD, S1_BTN, fmtDate } from "./SoftoneHeader";

const KIND: Record<string, { label: string; color: string }> = {
  direct: { label: "άμεσο", color: "var(--color-success)" }, derived: { label: "υπολογιζόμενο", color: "var(--color-info)" }, param: { label: "παράμετρος", color: "var(--color-purple)" }, constant: { label: "σταθερά", color: "#5C5C5C" }, gap: { label: "εκκρεμεί", color: "var(--color-warning)" },
};
const STATUS: Record<CheckResult["status"], { icon: React.ElementType; color: string; label: string }> = {
  ok: { icon: RiCheckboxCircleLine, color: "var(--color-success)", label: "ΟΚ" }, fail: { icon: RiCloseCircleLine, color: "var(--color-danger)", label: "Αποτυχία" }, warn: { icon: RiErrorWarningLine, color: "var(--color-warning)", label: "Προσοχή" }, skip: { icon: RiSkipForwardLine, color: "#5C5C5C", label: "Παράλειψη" },
};

export function SoftoneStructureClient({ maps, lookups, configured, lastPing }: { maps: EntityMap[]; lookups: { key: string; editor: string; label: string }[]; configured: boolean; lastPing: { at: string | null; ok: boolean | null; message: string | null } }) {
  const [open, setOpen] = useState<string | null>(null);
  const [running, start] = useTransition();
  const [res, setRes] = useState<{ ok: boolean; results: CheckResult[]; error?: string; version?: string; at?: string } | null>(null);

  function run() {
    start(async () => {
      const r = await runSoftoneReadinessChecks();
      setRes({ ...r, at: new Date().toISOString() });
    });
  }
  const groups = res ? [...new Set(res.results.map((r) => r.group))] : [];
  const summary = res ? { ok: res.results.filter((r) => r.status === "ok").length, fail: res.results.filter((r) => r.status === "fail").length, warn: res.results.filter((r) => r.status === "warn").length } : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Readiness checks */}
      <div style={S1_CARD}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <h2 style={{ fontSize: "var(--fs-15)", fontWeight: 600, margin: 0 }}>Έλεγχοι ετοιμότητας της εγκατάστασης</h2>
            <p style={{ fontSize: "var(--fs-12-5)", color: "var(--muted-foreground)", margin: "4px 0 0" }}>
              Μόνο αναγνώσεις (getObjects, getObjectTables, getTableFields, getSelectorData, getBrowserInfo): υπάρχουν τα αντικείμενα, τα πεδία και οι λίστες που απαιτεί η προδιαγραφή (§3, §7); Δεν αλλάζει τίποτα στο SoftOne.
            </p>
            {!configured && <p style={{ fontSize: "var(--fs-12-5)", color: "var(--color-warning)", margin: "6px 0 0" }}>Η σύνδεση δεν είναι ρυθμισμένη/ενεργή — συμπληρώστε πρώτα την καρτέλα «Σύνδεση».</p>}
            {lastPing.at && <p style={{ fontSize: "var(--fs-12)", color: "var(--muted-foreground)", margin: "6px 0 0" }}>Τελευταία δοκιμή σύνδεσης {fmtDate(lastPing.at)}: {lastPing.ok ? "ΟΚ" : "αποτυχία"} — {lastPing.message}</p>}
          </div>
          <button type="button" onClick={run} disabled={running || !configured} style={S1_BTN("primary", running || !configured)}>
            {running ? <RiLoader4Line style={{ animation: "s1spin 1s linear infinite" }} /> : <RiPlayLine />} {running ? "Εκτέλεση ελέγχων..." : "Εκτέλεση ελέγχων"}
          </button>
        </div>
        {res?.error && <div style={{ fontSize: "var(--fs-13)", color: "var(--color-danger)" }}><RiErrorWarningLine /> {res.error}</div>}
        {summary && !res?.error && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: "var(--fs-12-5)" }}>
            <span style={{ padding: "4px 10px", borderRadius: 999, background: "color-mix(in srgb, var(--color-success) 8%, transparent)", color: "var(--color-success)", fontWeight: 600 }}>✓ {summary.ok}</span>
            <span style={{ padding: "4px 10px", borderRadius: 999, background: "color-mix(in srgb, var(--color-warning) 8%, transparent)", color: "var(--color-warning)", fontWeight: 600 }}>! {summary.warn}</span>
            <span style={{ padding: "4px 10px", borderRadius: 999, background: "color-mix(in srgb, var(--color-danger) 8%, transparent)", color: "var(--color-danger)", fontWeight: 600 }}>✗ {summary.fail}</span>
            <span style={{ color: "var(--muted-foreground)", alignSelf: "center" }}>{fmtDate(res?.at)}{res?.version ? ` · SoftOne ${res.version}` : ""}</span>
          </div>
        )}
        {groups.map((g) => (
          <div key={g}>
            <div style={{ fontSize: "var(--fs-12)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--muted-foreground)", margin: "6px 0 6px" }}>{g}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {res!.results.filter((r) => r.group === g).map((r) => { const S = STATUS[r.status]; const Icon = S.icon; return (
                <div key={r.key} style={{ display: "grid", gridTemplateColumns: "22px minmax(0,1fr)", gap: 8, padding: "8px 10px", background: "var(--paper)", borderRadius: 8, fontSize: "var(--fs-12-5)" }}>
                  <Icon style={{ color: S.color, marginTop: 2 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{r.label}{r.spec && <span style={{ fontWeight: 400, color: "var(--muted-foreground)" }}> · προδιαγραφή {r.spec}</span>}</div>
                    <div style={{ color: r.status === "fail" ? "var(--color-danger)" : "var(--muted-foreground)", wordBreak: "break-word" }}>{r.detail}</div>
                  </div>
                </div>
              ); })}
            </div>
          </div>
        ))}
      </div>

      {/* Data structure */}
      <div style={S1_CARD}>
        <div>
          <h2 style={{ fontSize: "var(--fs-15)", fontWeight: 600, margin: 0 }}>Δομή δεδομένων — τι αντιστοιχεί σε τι</h2>
          <p style={{ fontSize: "var(--fs-12-5)", color: "var(--muted-foreground)", margin: "4px 0 0" }}>Κάθε οντότητα της Orithon και το αντικείμενο SoftOne στο οποίο θα γράφεται (προδιαγραφή §4). Οι σταθερές (TSODTYPE 13/12, MSODTYPE 52/51, PERIODINV 0/1, LINENUM ≥ 9000001) ορίζονται στον κώδικα.</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {maps.map((m) => {
            const on = open === m.key;
            return (
              <div key={m.key} style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
                <button type="button" onClick={() => setOpen(on ? null : m.key)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--paper)", border: "none", cursor: "pointer", textAlign: "left", color: "var(--foreground)", fontFamily: "inherit", minHeight: 44 }}>
                  {on ? <RiArrowDownSLine /> : <RiArrowRightSLine />}
                  <span style={{ fontWeight: 700, fontSize: "var(--fs-13-5)" }}>{m.caption}</span>
                  <span style={{ fontSize: "var(--fs-12)", color: "var(--muted-foreground)" }}>{m.ours} → <strong>{m.object}</strong> ({m.table}){m.lines ? ` + ${m.lines.table}` : ""}</span>
                  <span style={{ marginLeft: "auto", fontSize: "var(--fs-11)", color: "var(--muted-foreground)", whiteSpace: "nowrap" }}>{m.fields.length + (m.lines?.fields.length ?? 0)} πεδία · δεσμός {m.linkField}</span>
                </button>
                {on && (
                  <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10, fontSize: "var(--fs-12-5)" }}>
                    <p style={{ margin: 0, color: "var(--muted-foreground)" }}>{m.description}</p>
                    <FieldTable title={`${m.table} (κεφαλίδα)`} fields={m.fields} />
                    {m.lines && <FieldTable title={`${m.lines.table} — ${m.lines.caption}`} fields={m.lines.fields} />}
                    <div><strong>Προαπαιτούμενα:</strong> {m.prerequisites.join(" · ")}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div>
          <div style={{ fontSize: "var(--fs-12)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--muted-foreground)", marginBottom: 6 }}>Λίστες παραμέτρων που πρέπει να οριστούν</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {lookups.map((l) => <span key={l.key} style={{ fontSize: "var(--fs-12)", padding: "4px 10px", borderRadius: 999, background: "var(--paper)", border: "1px solid var(--border)" }}>{l.label} <span style={{ color: "var(--muted-foreground)" }}>({l.editor})</span></span>)}
          </div>
        </div>
      </div>
      <style>{`@keyframes s1spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function FieldTable({ title, fields }: { title: string; fields: EntityMap["fields"] }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{title}</div>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead><tr>{["SoftOne", "Orithon", "Είδος", "Σημείωση"].map((h) => <th key={h} style={{ textAlign: "left", padding: "5px 8px", borderBottom: "1px solid var(--border)", color: "var(--muted-foreground)", fontWeight: 600, fontSize: "var(--fs-11)", textTransform: "uppercase" }}>{h}</th>)}</tr></thead>
        <tbody>
          {fields.map((f, i) => (
            <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
              <td style={{ padding: "5px 8px", fontFamily: "monospace", whiteSpace: "nowrap" }}>{f.s1}{f.required && <span style={{ color: "var(--color-danger)" }}> *</span>}</td>
              <td style={{ padding: "5px 8px" }}>{f.ours}</td>
              <td style={{ padding: "5px 8px", whiteSpace: "nowrap" }}><span style={{ color: KIND[f.kind]?.color, fontWeight: 600 }}>{KIND[f.kind]?.label ?? f.kind}</span></td>
              <td style={{ padding: "5px 8px", color: "var(--muted-foreground)" }}>{f.note ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
