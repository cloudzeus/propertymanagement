"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { runCronJobNow } from "@/app/actions/cron";
import { RiTimerLine, RiPlayLine, RiCheckLine, RiCloseLine, RiLoaderLine } from "react-icons/ri";

type Run = { id: string; trigger: string; startedAt: string; finishedAt: string | null; ok: boolean | null; result: Record<string, unknown> | null; error: string | null };
type Job = { key: string; label: string; description: string; schedule: { kind: "daily" | "monthly"; hour: number }; runs: Run[] };

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("el-GR", { dateStyle: "short", timeStyle: "short" }) : "—");
const TRIGGER: Record<string, string> = { scheduler: "αυτόματα", http: "εξωτερικά", manual: "χειροκίνητα" };

export function CronClient({ jobs, schedulerEnabled }: { jobs: Job[]; schedulerEnabled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [, start] = useTransition();
  function run(key: string) {
    setBusy(key); setMsg(null);
    start(async () => {
      const r = await runCronJobNow(key);
      setBusy(null);
      setMsg("error" in r && r.error ? `Σφάλμα: ${r.error}` : `Ολοκληρώθηκε: ${JSON.stringify(r.result ?? {})}`);
      router.refresh();
    });
  }
  return (
    <div className="dash-page" style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 960 }}>
      <div>
        <h1 style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "var(--fs-22)", fontWeight: 700, margin: 0, color: "var(--foreground)" }}><RiTimerLine style={{ color: "var(--color-primary)" }} /> Αυτόματες εργασίες</h1>
        <p style={{ margin: "4px 0 0", fontSize: "var(--fs-13)", color: "var(--muted-foreground)" }}>
          Τρέχουν μέσα από την εφαρμογή, χωρίς εξωτερικό cron. Ο χρονοπρογραμματιστής ελέγχει κάθε 5 λεπτά και εκτελεί ό,τι είναι ώρα του (ώρα Ελλάδας).
        </p>
      </div>
      <div style={{ padding: "8px 12px", borderRadius: 8, fontSize: "var(--fs-13)", background: schedulerEnabled ? "#2E7D5B14" : "#CA5D0014", color: schedulerEnabled ? "#2E7D5B" : "#CA5D00", border: `1px solid ${schedulerEnabled ? "#2E7D5B40" : "#CA5D0040"}` }}>
        {schedulerEnabled ? "Ο χρονοπρογραμματιστής είναι ενεργός σε αυτόν τον server." : "Ο χρονοπρογραμματιστής είναι ανενεργός εδώ (τρέχει μόνο σε production ή με CRON_IN_PROCESS=true). Μπορείτε να εκτελέσετε τις εργασίες χειροκίνητα."}
      </div>
      {msg && <div style={{ fontSize: "var(--fs-13)", padding: "8px 12px", borderRadius: 8, background: "var(--paper)", border: "1px solid var(--border)", wordBreak: "break-word" }}>{msg}</div>}
      {jobs.map((j) => (
        <div key={j.key} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 16 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: "var(--fs-15)", fontWeight: 700 }}>{j.label}</div>
              <div style={{ fontSize: "var(--fs-12-5)", color: "var(--muted-foreground)", marginTop: 2 }}>{j.description}</div>
              <div style={{ fontSize: "var(--fs-12)", color: "var(--muted-foreground)", marginTop: 6 }}>Πρόγραμμα: {j.schedule.kind === "daily" ? "καθημερινά" : "την 1η κάθε μήνα"} μετά τις {String(j.schedule.hour).padStart(2, "0")}:00</div>
            </div>
            <button disabled={busy === j.key} onClick={() => run(j.key)} style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 38, padding: "0 14px", borderRadius: 999, border: "none", background: "var(--primary)", color: "var(--primary-foreground)", fontWeight: 600, fontSize: "var(--fs-13)", cursor: "pointer" }}>
              {busy === j.key ? <RiLoaderLine style={{ animation: "spin 1s linear infinite" }} /> : <RiPlayLine />} Εκτέλεση τώρα
            </button>
          </div>
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 4 }}>
            {j.runs.length === 0 && <div style={{ fontSize: "var(--fs-12-5)", color: "var(--muted-foreground)" }}>Δεν έχει τρέξει ακόμη.</div>}
            {j.runs.map((r) => (
              <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "var(--fs-12-5)", flexWrap: "wrap", padding: "6px 10px", background: "var(--paper)", borderRadius: 8 }}>
                {r.ok === true ? <RiCheckLine style={{ color: "#2E7D5B" }} /> : r.ok === false ? <RiCloseLine style={{ color: "#C0392B" }} /> : <RiLoaderLine />}
                <span>{fmt(r.startedAt)}</span>
                <span style={{ color: "var(--muted-foreground)" }}>{TRIGGER[r.trigger] ?? r.trigger}</span>
                <span style={{ color: "var(--muted-foreground)", wordBreak: "break-all" }}>{r.error ? r.error.split("\n")[0] : r.result ? JSON.stringify(r.result) : ""}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
