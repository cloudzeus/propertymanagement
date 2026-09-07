"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { assignProgrammeSupplier, openProgrammeOccurrence } from "@/app/actions/maintenance-program";
import type { ProgrammeRow } from "@/lib/dashboard/maintenance-program";
import { RiCalendarTodoLine, RiArrowLeftSLine, RiArrowRightSLine, RiToolsLine, RiCheckLine, RiAlarmWarningLine, RiLoaderLine, RiExternalLinkLine } from "react-icons/ri";

const MONTHS = ["Ιαν", "Φεβ", "Μαρ", "Απρ", "Μάι", "Ιουν", "Ιουλ", "Αυγ", "Σεπ", "Οκτ", "Νοε", "Δεκ"];
const FREQ: Record<string, string> = { WEEKLY: "Εβδομαδιαία", MONTHLY: "Μηνιαία", QUARTERLY: "Τριμηνιαία", SEMIANNUAL: "Εξαμηνιαία", ANNUAL: "Ετήσια", CUSTOM: "Εφάπαξ" };
const KIND: Record<string, string> = { GENERAL: "Γενική", ELEVATOR: "Ανελκυστήρας", BOILER: "Λέβητας", FIRE_SAFETY: "Πυρασφάλεια", HVAC: "Κλιματισμός", ELECTRICAL: "Ηλεκτρολογικά", PLUMBING: "Υδραυλικά", OTHER: "Άλλο" };
const DONE = ["COMPLETED", "CONFIRMED"];

export function ProgrammeClient({ year, buildingId, rows, buildings, caps }: {
  year: number; buildingId: string | null; rows: ProgrammeRow[]; buildings: { id: string; name: string }[]; caps: { edit: boolean; create: boolean };
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [, start] = useTransition();
  const now = useMemo(() => new Date(), []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows.filter((r) => (!kind || r.kind === kind) && (!t || [r.title, r.buildingName, r.customerName, r.supplierName ?? "", r.itemName ?? ""].some((v) => v.toLowerCase().includes(t))));
  }, [rows, q, kind]);

  const stats = useMemo(() => {
    const all = rows.flatMap((r) => r.occurrences);
    return {
      tasks: rows.length,
      occ: all.length,
      done: all.filter((o) => o.requestStatus && DONE.includes(o.requestStatus)).length,
      overdue: all.filter((o) => new Date(o.date) < now && !o.requestId).length,
      noSupplier: rows.filter((r) => !r.supplierId).length,
    };
  }, [rows, now]);

  function nav(next: { year?: number; building?: string | null }) {
    const p = new URLSearchParams();
    p.set("year", String(next.year ?? year));
    const b = next.building === undefined ? buildingId : next.building;
    if (b) p.set("building", b);
    router.push(`/admin/maintenance-program?${p}`);
  }
  function assign(taskId: string, supplierId: string) {
    setBusy(taskId); setErr(null);
    start(async () => {
      const res = await assignProgrammeSupplier(taskId, supplierId || null);
      if (res && "error" in res && res.error) setErr(res.error);
      setBusy(null); router.refresh();
    });
  }
  function open(taskId: string, dateIso: string) {
    setBusy(`${taskId}@${dateIso}`); setErr(null);
    start(async () => {
      const res = await openProgrammeOccurrence(taskId, dateIso);
      setBusy(null);
      if ("error" in res && res.error) { setErr(res.error); return; }
      router.push(`/admin/maintenance/${res.id}`);
    });
  }

  return (
    <div className="dash-page" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <h1 style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "var(--fs-22)", fontWeight: 700, margin: 0, color: "var(--foreground)" }}><RiCalendarTodoLine style={{ color: "var(--color-primary)" }} /> Ετήσιο πρόγραμμα συντηρήσεων</h1>
          <p style={{ margin: "4px 0 0", fontSize: "var(--fs-13)", color: "var(--muted-foreground)" }}>Όλες οι τακτικές συντηρήσεις ανά μήνα. Ο ίδιος συνεργάτης προτείνεται πρώτος σε κάθε κτήριο· από κάθε κουκκίδα ανοίγει η εργασία του μήνα με έτοιμη ανάθεση.</p>
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", border: "1px solid var(--border)", borderRadius: 999, background: "var(--card)", height: 36 }}>
          <button onClick={() => nav({ year: year - 1 })} style={yBtn}><RiArrowLeftSLine /></button>
          <span style={{ fontWeight: 800, fontSize: "var(--fs-15)", padding: "0 6px" }}>{year}</span>
          <button onClick={() => nav({ year: year + 1 })} style={yBtn}><RiArrowRightSLine /></button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
        {[["Προγράμματα", stats.tasks], ["Επισκέψεις έτους", stats.occ], ["Ολοκληρωμένες", stats.done], ["Εκπρόθεσμες χωρίς εργασία", stats.overdue], ["Χωρίς συνεργάτη", stats.noSupplier]].map(([l, v]) => (
          <div key={String(l)} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "10px 14px" }}>
            <div style={{ fontSize: "var(--fs-11-5)", color: "var(--muted-foreground)" }}>{l}</div>
            <div style={{ fontSize: "var(--fs-22)", fontWeight: 700, color: l === "Εκπρόθεσμες χωρίς εργασία" && Number(v) > 0 ? "#C0392B" : "var(--foreground)" }}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <select value={buildingId ?? ""} onChange={(e) => nav({ building: e.target.value || null })} style={sel}><option value="">Όλα τα κτήρια</option>{buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
        <select value={kind} onChange={(e) => setKind(e.target.value)} style={sel}><option value="">Όλα τα είδη</option>{Object.entries(KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Αναζήτηση…" style={{ ...sel, minWidth: 220 }} />
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: "var(--fs-12)", color: "var(--muted-foreground)", display: "inline-flex", gap: 12 }}>
          <span><Dot color="var(--color-primary)" /> προγραμματισμένη</span><span><Dot color="#2E7D5B" /> έγινε</span><span><Dot color="#CA5D00" /> ανοιχτή εργασία</span><span><Dot color="#C0392B" /> εκπρόθεσμη</span>
        </span>
      </div>
      {err && <div style={{ color: "var(--destructive)", fontSize: "var(--fs-13)" }}>{err}</div>}

      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "auto", flex: 1, minHeight: 0 }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 1100 }}>
          <thead>
            <tr style={{ background: "var(--paper)" }}>
              <th style={th}>Συντήρηση</th>
              <th style={th}>Κτήριο</th>
              <th style={{ ...th, minWidth: 220 }}>Συνεργάτης</th>
              {MONTHS.map((m, i) => <th key={m} style={{ ...th, textAlign: "center", width: 44, color: year === now.getFullYear() && i === now.getMonth() ? "var(--color-primary)" : undefined }}>{m}</th>)}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={15} style={{ padding: 32, textAlign: "center", color: "var(--muted-foreground)", fontSize: "var(--fs-13)" }}>Δεν υπάρχουν ενεργές τακτικές συντηρήσεις για αυτά τα φίλτρα. Ορίζονται από την καρτέλα «Συντηρήσεις» κάθε κτηρίου.</td></tr>}
            {filtered.map((r) => {
              const byMonth = new Map<number, typeof r.occurrences>();
              for (const o of r.occurrences) { const d = new Date(o.date); if (d.getFullYear() !== year) continue; const arr = byMonth.get(d.getMonth()) ?? []; arr.push(o); byMonth.set(d.getMonth(), arr); }
              return (
                <tr key={r.taskId} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={td}>
                    <div style={{ fontWeight: 600, color: "var(--foreground)" }}>{r.title}</div>
                    <div style={{ fontSize: "var(--fs-11-5)", color: "var(--muted-foreground)" }}>{KIND[r.kind] ?? r.kind} · {FREQ[r.frequency] ?? r.frequency}{r.itemName ? ` · ${r.itemName}` : ""}{r.inServicePackage ? " · στο πακέτο" : ""}</div>
                  </td>
                  <td style={td}><div>{r.buildingName}</div><div style={{ fontSize: "var(--fs-11-5)", color: "var(--muted-foreground)" }}>{r.customerName}{r.managed ? "" : " · μη διαχειριζόμενο"}</div></td>
                  <td style={td}>
                    {caps.edit ? (
                      <select value={r.supplierId ?? ""} disabled={busy === r.taskId} onChange={(e) => assign(r.taskId, e.target.value)} style={{ ...sel, width: "100%", fontSize: "var(--fs-12-5)" }}>
                        <option value="">{r.vendor ? `— (${r.vendor})` : "— χωρίς συνεργάτη"}</option>
                        {r.suggestions.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                        {r.supplierId && !r.suggestions.some((s) => s.id === r.supplierId) && <option value={r.supplierId}>{r.supplierName}</option>}
                      </select>
                    ) : (r.supplierName ?? r.vendor ?? "—")}
                  </td>
                  {MONTHS.map((_, i) => {
                    const occ = byMonth.get(i) ?? [];
                    if (occ.length === 0) return <td key={i} style={{ ...td, textAlign: "center" }} />;
                    return (
                      <td key={i} style={{ ...td, textAlign: "center", padding: "6px 2px" }}>
                        {occ.map((o) => {
                          const d = new Date(o.date);
                          const state = o.requestStatus ? (DONE.includes(o.requestStatus) ? "done" : "open") : d < now ? "overdue" : "planned";
                          const color = state === "done" ? "#2E7D5B" : state === "open" ? "#CA5D00" : state === "overdue" ? "#C0392B" : "var(--color-primary)";
                          const key = `${r.taskId}@${o.date}`;
                          const title = `${d.toLocaleDateString("el-GR")} — ${state === "done" ? "ολοκληρώθηκε" : state === "open" ? "ανοιχτή εργασία" : state === "overdue" ? "εκπρόθεσμη — άνοιγμα εργασίας" : "άνοιγμα εργασίας"}`;
                          if (o.requestId) return <Link key={key} href={`/admin/maintenance/${o.requestId}`} title={title} style={{ ...dotBtn, color, borderColor: `${color}66`, background: `${color}14` }}>{state === "done" ? <RiCheckLine /> : <RiToolsLine />}</Link>;
                          return (
                            <button key={key} disabled={!caps.create || busy === key} onClick={() => open(r.taskId, o.date)} title={title} style={{ ...dotBtn, color, borderColor: `${color}66`, background: "transparent", cursor: caps.create ? "pointer" : "default" }}>
                              {busy === key ? <RiLoaderLine style={{ animation: "spin 1s linear infinite" }} /> : state === "overdue" ? <RiAlarmWarningLine /> : <span style={{ width: 8, height: 8, borderRadius: 999, background: color, display: "inline-block" }} />}
                            </button>
                          );
                        })}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: "var(--fs-12)", color: "var(--muted-foreground)", margin: 0 }}>
        <RiExternalLinkLine style={{ verticalAlign: "-2px" }} /> Νέα τακτική συντήρηση: ανοίξτε το κτήριο → «Συντηρήσεις» → «Νέα τακτική εργασία». Το ημερολόγιο του προσωπικού δείχνει τις ίδιες επισκέψεις.
      </p>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function Dot({ color }: { color: string }) { return <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 999, background: color, marginRight: 4, verticalAlign: "middle" }} />; }
const yBtn: React.CSSProperties = { border: "none", background: "transparent", cursor: "pointer", width: 32, height: 34, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--foreground)", fontSize: "var(--fs-18)" };
const sel: React.CSSProperties = { height: 34, padding: "0 10px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "var(--card)", color: "var(--foreground)", fontSize: "var(--fs-13)" };
const th: React.CSSProperties = { padding: "10px 12px", textAlign: "left", fontSize: "var(--fs-11-5)", fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: ".04em", whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "8px 12px", fontSize: "var(--fs-13)", verticalAlign: "middle" };
const dotBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 8, border: "1px solid", margin: 1, fontSize: "var(--fs-14)", textDecoration: "none" };
