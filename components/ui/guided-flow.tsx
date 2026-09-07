"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/ui/modal";
import { RiArrowLeftLine, RiArrowRightLine, RiCheckLine, RiLoaderLine, RiInformationLine } from "react-icons/ri";

/**
 * Guided, step-by-step alternative to a dense form — for users who are not
 * comfortable with computers. One question per step, plain-language help,
 * big multiple-choice cards, and a summary before anything is saved.
 *
 * The caller owns the state; each step only renders and validates it.
 */
export type FlowStep = {
  key: string;
  title: string;
  /** plain-language explanation shown above the step's controls */
  help?: React.ReactNode;
  render: () => React.ReactNode;
  /** return an error message to block "Συνέχεια", or null */
  validate?: () => string | null;
};

export function GuidedFlow({ title, steps, onClose, onFinish, finishLabel = "Ολοκλήρωση", width = 720, onSimpleForm }: {
  title: string;
  steps: FlowStep[];
  onClose: () => void;
  /** save everything; resolve with { error } to stay on the summary step */
  onFinish: () => Promise<{ error?: string | null } | void>;
  finishLabel?: string;
  width?: number;
  /** offered to experienced users: "Προτιμώ την απλή φόρμα" */
  onSimpleForm?: () => void;
}) {
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const cur = steps[step];
  const last = step === steps.length - 1;

  function next() {
    const e = cur.validate?.() ?? null;
    if (e) { setError(e); return; }
    setError(null);
    setStep((s) => Math.min(s + 1, steps.length - 1));
  }
  function back() { setError(null); setStep((s) => Math.max(s - 1, 0)); }
  function finish() {
    const e = cur.validate?.() ?? null;
    if (e) { setError(e); return; }
    setError(null);
    startTransition(async () => {
      const res = await onFinish();
      if (res && "error" in res && res.error) setError(res.error);
    });
  }

  return (
    <Modal open onClose={onClose} title={title} width={width}
      footer={
        <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
          {onSimpleForm && <button onClick={onSimpleForm} style={linkBtn}>Προτιμώ την απλή φόρμα</button>}
          <span style={{ flex: 1 }} />
          <button onClick={step === 0 ? onClose : back} disabled={isPending} style={ghostBtn}>
            {step === 0 ? "Ακύρωση" : <><RiArrowLeftLine /> Πίσω</>}
          </button>
          {last
            ? <button onClick={finish} disabled={isPending} style={primaryBtn}>{isPending ? <RiLoaderLine style={{ animation: "spin 1s linear infinite" }} /> : <RiCheckLine />} {finishLabel}</button>
            : <button onClick={next} style={primaryBtn}>Συνέχεια <RiArrowRightLine /></button>}
        </div>
      }>
      {/* step rail — numbers are the real order */}
      <ol style={{ listStyle: "none", margin: "0 0 16px", padding: 0, display: "grid", gridTemplateColumns: `repeat(${steps.length}, 1fr)`, gap: 4 }}>
        {steps.map((s, i) => {
          const state = i < step ? "done" : i === step ? "active" : "todo";
          return (
            <li key={s.key} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 8px", borderRadius: 8, fontSize: "var(--fs-12)", fontWeight: 600, minWidth: 0,
              background: state === "active" ? "var(--color-primary)" : "var(--paper)",
              color: state === "active" ? "#fff" : state === "done" ? "var(--foreground)" : "var(--muted-foreground)" }}>
              <span style={{ width: 20, height: 20, borderRadius: 999, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "var(--fs-11)",
                background: state === "done" ? "#15803d" : "transparent", color: state === "done" ? "#fff" : "inherit", border: state === "done" ? "none" : "1px solid currentColor" }}>
                {state === "done" ? <RiCheckLine /> : i + 1}
              </span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</span>
            </li>
          );
        })}
      </ol>

      <div style={{ fontSize: "var(--fs-17)", fontWeight: 800, color: "var(--foreground)", marginBottom: 6 }}>{step + 1}. {cur.title}</div>
      {cur.help && (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: "var(--fs-13-5)", lineHeight: 1.5, color: "var(--foreground)", background: "var(--paper)", borderRadius: 8, padding: "10px 12px", marginBottom: 14 }}>
          <RiInformationLine style={{ marginTop: 3, flexShrink: 0, color: "var(--color-primary)" }} />
          <div>{cur.help}</div>
        </div>
      )}
      {error && <div style={errBox} role="alert">{error}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>{cur.render()}</div>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </Modal>
  );
}

export type Choice<T extends string> = { value: T; label: string; description?: string; icon?: React.ElementType };

/** Big, tappable multiple-choice cards — one answer. */
export function ChoiceCards<T extends string>({ options, value, onChange, columns = 2 }: {
  options: Choice<T>[]; value: T | null; onChange: (v: T) => void; columns?: number;
}) {
  return (
    <div role="radiogroup" style={{ display: "grid", gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: 8 }}>
      {options.map((o) => {
        const on = o.value === value;
        const Icon = o.icon;
        return (
          <button key={o.value} type="button" role="radio" aria-checked={on} onClick={() => onChange(o.value)}
            style={{ display: "flex", alignItems: "flex-start", gap: 10, textAlign: "left", padding: "12px 14px", borderRadius: 10, cursor: "pointer", minHeight: 58,
              border: `2px solid ${on ? "var(--color-primary)" : "var(--border)"}`, background: on ? "var(--color-primary)0f" : "var(--card)", color: "var(--foreground)" }}>
            {Icon && <Icon style={{ fontSize: "var(--fs-22)", flexShrink: 0, marginTop: 1, color: on ? "var(--color-primary)" : "var(--muted-foreground)" }} />}
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontSize: "var(--fs-14)", fontWeight: 700 }}>{o.label}</span>
              {o.description && <span style={{ display: "block", fontSize: "var(--fs-12-5)", color: "var(--muted-foreground)", marginTop: 2, lineHeight: 1.4 }}>{o.description}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Label/value rows for the final "Έλεγχος" step. */
export function SummaryList({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
      {rows.map(([k, v], i) => (
        <div key={k} style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 10, padding: "9px 14px", fontSize: "var(--fs-13-5)", borderTop: i ? "1px solid var(--border)" : "none" }}>
          <span style={{ color: "var(--muted-foreground)" }}>{k}</span>
          <span style={{ color: "var(--foreground)", overflowWrap: "anywhere" }}>{v || "—"}</span>
        </div>
      ))}
    </div>
  );
}

const linkBtn: React.CSSProperties = { background: "none", border: "none", color: "var(--muted-foreground)", fontSize: "var(--fs-12-5)", cursor: "pointer", padding: 0, textDecoration: "underline" };
const ghostBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--card)", cursor: "pointer", fontSize: "var(--fs-13)", color: "var(--foreground)" };
const primaryBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 18px", borderRadius: 6, border: "none", background: "var(--color-primary)", color: "#fff", cursor: "pointer", fontSize: "var(--fs-13)", fontWeight: 600 };
const errBox: React.CSSProperties = { padding: "8px 12px", borderRadius: 6, background: "#fee2e218", color: "#dc2626", fontSize: "var(--fs-12-5)", border: "1px solid #fca5a530", marginBottom: 12 };
