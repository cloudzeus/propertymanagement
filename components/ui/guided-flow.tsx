"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Modal } from "@/components/ui/modal";
import { RiArrowLeftLine, RiArrowRightLine, RiCheckLine, RiLoaderLine, RiInformationLine, RiBookOpenLine, RiHistoryLine } from "react-icons/ri";
import { usePhone } from "@/lib/use-media-query";
import { draftStorageKey, formatDraftAge, parseDraft, serializeDraft } from "@/lib/wizards/draft";
import { EXAMPLE_STEP_KEY, stepLabel, withExampleStep } from "@/lib/wizards/flow";
import { DoneScreen, type DoneNext } from "./guided-flow-parts";
import { HelpVideoPlayer, type WizardVideo } from "@/components/wizards/HelpVideoPlayer";

export type { WizardVideo };

/**
 * Guided, step-by-step alternative to a dense form — for users who are not
 * comfortable with computers. One question per step, plain-language help,
 * big multiple-choice cards, a summary, and (v2) an «Παράδειγμα εφαρμογής»
 * step computed from what was just entered, a draft that survives closing
 * the modal, and an «Έγινε!» screen that offers the next step of the chain.
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

export type FlowExample = {
  title?: string;
  render: () => React.ReactNode;
  video?: WizardVideo | null;
  /** Link to the wiki guide (help hub `?a=<guideSlug>`). */
  guideHref?: string;
};

export type FlowDone = { title: string; lines?: string[]; next?: DoneNext[] };

export type FlowDraft<T extends object> = {
  key: string;
  ctxId?: string | null;
  value: T;
  restore: (value: T, step: number) => void;
  /** keys never persisted (passwords) */
  omit?: (keyof T)[];
};

type FinishResult = { error?: string | null; done?: FlowDone } | void;

export function GuidedFlow<T extends object = Record<string, unknown>>({ title, steps, onClose, onFinish, finishLabel = "Ολοκλήρωση", width = 720, onSimpleForm, example, draft, dirty = false }: {
  title: string;
  steps: FlowStep[];
  onClose: () => void;
  /** save everything; resolve with { error } to stay on the last step, { done } to show the «Έγινε!» screen */
  onFinish: () => Promise<FinishResult>;
  finishLabel?: string;
  width?: number;
  /** offered to experienced users: "Προτιμώ την απλή φόρμα" */
  onSimpleForm?: () => void;
  /** last step: a computed example of what the entered data will produce */
  example?: FlowExample | null;
  /** persist the form values in localStorage while the wizard is open */
  draft?: FlowDraft<T>;
  /** when true, closing asks whether to keep a draft (or confirms discarding) */
  dirty?: boolean;
}) {
  const phone = usePhone();
  const rail = useMemo(() => withExampleStep(steps, example), [steps, example]);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState<FlowDone | null>(null);
  const [closing, setClosing] = useState(false);
  const headingRef = useRef<HTMLDivElement>(null);
  const cur = rail[step];
  const last = step === rail.length - 1;
  const isExample = cur?.key === EXAMPLE_STEP_KEY;

  // ── Drafts ──────────────────────────────────────────────────────────────
  const storageKey = draft ? draftStorageKey(draft.key, draft.ctxId) : null;
  // The modal mounts client-side after a click, so the stored draft can be read once, lazily.
  const [pendingDraft, setPendingDraft] = useState<{ value: T; step: number; savedAt: number } | null>(() => {
    if (!draft || !storageKey || typeof window === "undefined") return null;
    let raw: string | null = null;
    try { raw = window.localStorage.getItem(storageKey); } catch { /* private mode */ }
    return parseDraft(raw, draft.value);
  });
  const armed = useRef(pendingDraft === null); // only persist after the "resume?" question is answered

  const writeDraft = useCallback(() => {
    if (!draft || !storageKey) return;
    try { window.localStorage.setItem(storageKey, serializeDraft(draft.value, step, draft.omit ?? [])); } catch { /* ignore */ }
  }, [draft, storageKey, step]);
  const clearDraft = useCallback(() => {
    if (!storageKey) return;
    try { window.localStorage.removeItem(storageKey); } catch { /* ignore */ }
  }, [storageKey]);
  // Persist only real progress: an untouched form never overwrites an earlier draft (e.g. after a remount).
  useEffect(() => {
    if (!draft || !armed.current || done || !dirty) return;
    const t = setTimeout(writeDraft, 300);
    return () => clearTimeout(t);
  }, [draft, draft?.value, step, writeDraft, done, dirty]);

  // ── Focus the step heading on change (screen readers + keyboard) ────────
  useEffect(() => { headingRef.current?.focus({ preventScroll: true }); }, [step]);

  function next() {
    const e = cur.validate?.() ?? null;
    if (e) { setError(e); return; }
    setError(null);
    setStep((s) => Math.min(s + 1, rail.length - 1));
  }
  function back() { setError(null); setStep((s) => Math.max(s - 1, 0)); }
  function goTo(i: number) { if (i < step) { setError(null); setStep(i); } }
  function finish() {
    const e = cur.validate?.() ?? null;
    if (e) { setError(e); return; }
    setError(null);
    startTransition(async () => {
      const res = await onFinish();
      if (res && "error" in res && res.error) { setError(res.error); return; }
      clearDraft();
      if (res && "done" in res && res.done) setDone(res.done);
    });
  }
  function requestClose() {
    if (done) { onClose(); return; }
    if (dirty) { setClosing(true); return; }
    onClose();
  }
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "Enter" || e.shiftKey || isPending || done || closing) return;
    const t = e.target as HTMLElement;
    if (["TEXTAREA", "BUTTON", "SELECT", "A"].includes(t.tagName) || t.isContentEditable || (e.nativeEvent as KeyboardEvent).isComposing) return;
    e.preventDefault();
    if (last) finish(); else next();
  }

  const labelId = "gf-step-title";

  return (
    <Modal open onClose={requestClose} title={title} width={width}
      footer={done || closing ? undefined : (
        <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", flexWrap: "wrap" }}>
          {onSimpleForm && <button type="button" onClick={onSimpleForm} style={linkBtn}>Προτιμώ την απλή φόρμα</button>}
          <span style={{ flex: 1 }} />
          <button type="button" onClick={step === 0 ? requestClose : back} disabled={isPending} style={ghostBtn}>
            {step === 0 ? "Ακύρωση" : <><RiArrowLeftLine /> Πίσω</>}
          </button>
          {last
            ? <button type="button" onClick={finish} disabled={isPending} style={primaryBtn}>{isPending ? <RiLoaderLine style={{ animation: "spin 1s linear infinite" }} /> : <RiCheckLine />} {finishLabel}</button>
            : <button type="button" onClick={next} style={primaryBtn}>Συνέχεια <RiArrowRightLine /></button>}
        </div>
      )}>
      {done ? (
        <DoneScreen title={done.title} lines={done.lines} next={done.next} onClose={onClose} />
      ) : closing ? (
        <ClosePrompt hasDraft={!!draft} onKeep={() => { writeDraft(); onClose(); }} onDiscard={() => { clearDraft(); onClose(); }} onBack={() => setClosing(false)} />
      ) : (
        <div onKeyDown={onKeyDown}>
          {pendingDraft && (
            <div role="group" aria-label="Μισοτελειωμένη καταχώριση" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", background: "var(--warning-soft)", border: "1px solid color-mix(in srgb, var(--color-warning) 30%, transparent)", borderRadius: 10, padding: "10px 12px", marginBottom: 14, fontSize: "var(--fs-13)", color: "var(--foreground)" }}>
              <RiHistoryLine style={{ color: "var(--color-warning)", flexShrink: 0, fontSize: "var(--fs-18)" }} />
              <span style={{ flex: 1, minWidth: 180 }}>Βρήκαμε μια μισοτελειωμένη καταχώριση ({formatDraftAge(pendingDraft.savedAt)}).</span>
              <button type="button" style={primarySmall} onClick={() => { const p = pendingDraft; setPendingDraft(null); armed.current = true; draft?.restore(p.value, Math.min(p.step, rail.length - 1)); setStep(Math.min(p.step, rail.length - 1)); }}>Συνέχεια</button>
              <button type="button" style={ghostSmall} onClick={() => { setPendingDraft(null); armed.current = true; clearDraft(); }}>Από την αρχή</button>
            </div>
          )}

          {/* step rail — numbers are the real order; done steps are clickable */}
          {phone ? (
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--fs-12)", fontWeight: 600, color: "var(--muted-foreground)", marginBottom: 6 }}>
                <span>{stepLabel(step, rail.length)}</span>
                {step > 0 && <button type="button" onClick={back} style={linkBtn}>Πίσω</button>}
              </div>
              <div role="progressbar" aria-valuemin={1} aria-valuemax={rail.length} aria-valuenow={step + 1} style={{ height: 6, borderRadius: 999, background: "var(--paper)", overflow: "hidden" }}>
                <div style={{ width: `${((step + 1) / rail.length) * 100}%`, height: "100%", background: "var(--color-primary)", transition: "width .25s ease" }} />
              </div>
            </div>
          ) : (
            <ol aria-label={stepLabel(step, rail.length)} style={{ listStyle: "none", margin: "0 0 16px", padding: 0, display: "grid", gridTemplateColumns: `repeat(${rail.length}, 1fr)`, gap: 4 }}>
              {rail.map((s, i) => {
                const state = i < step ? "done" : i === step ? "active" : "todo";
                const Tag = state === "done" ? "button" : "div";
                return (
                  <li key={s.key} aria-current={state === "active" ? "step" : undefined} style={{ minWidth: 0 }}>
                    <Tag type={state === "done" ? "button" : undefined} onClick={state === "done" ? () => goTo(i) : undefined}
                      style={{ width: "100%", display: "flex", alignItems: "center", gap: 6, padding: "7px 8px", borderRadius: 8, fontSize: "var(--fs-12)", fontWeight: 600, minWidth: 0, border: "none", cursor: state === "done" ? "pointer" : "default", font: "inherit",
                        background: state === "active" ? "var(--color-primary)" : "var(--paper)",
                        color: state === "active" ? "#fff" : state === "done" ? "var(--foreground)" : "var(--muted-foreground)" }}>
                      <span style={{ width: 20, height: 20, borderRadius: 999, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "var(--fs-11)",
                        background: state === "done" ? "var(--color-success)" : "transparent", color: state === "done" ? "#fff" : "inherit", border: state === "done" ? "none" : "1px solid currentColor" }}>
                        {state === "done" ? <RiCheckLine /> : i + 1}
                      </span>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</span>
                    </Tag>
                  </li>
                );
              })}
            </ol>
          )}

          <div key={cur.key} className="gf-step">
            <div ref={headingRef} id={labelId} tabIndex={-1} style={{ fontSize: "var(--fs-17)", fontWeight: 800, color: "var(--foreground)", marginBottom: 6, outline: "none" }}>{step + 1}. {cur.title}</div>
            {!isExample && (cur as FlowStep).help && (
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: "var(--fs-13-5)", lineHeight: 1.5, color: "var(--foreground)", background: "var(--paper)", borderRadius: 8, padding: "10px 12px", marginBottom: 14 }}>
                <RiInformationLine style={{ marginTop: 3, flexShrink: 0, color: "var(--color-primary)" }} />
                <div>{(cur as FlowStep).help}</div>
              </div>
            )}
            {isExample && (
              <div style={{ fontSize: "var(--fs-13-5)", lineHeight: 1.5, color: "var(--muted-foreground)", marginBottom: 14 }}>
                Έτσι θα εφαρμοστεί αυτό που καταχωρίσατε. Αν κάτι δεν είναι σωστό, πατήστε «Πίσω»· τίποτα δεν έχει αποθηκευτεί ακόμη.
              </div>
            )}
            {error && <div style={errBox} role="alert">{error}</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {isExample ? example!.render() : (cur as FlowStep).render()}
              {isExample && (example!.video || example!.guideHref) && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
                  {example!.video && <HelpVideoPlayer video={example!.video} />}
                  {example!.guideHref && (
                    <a href={example!.guideHref} target="_blank" rel="noopener" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "var(--fs-13)", color: "var(--color-primary)", fontWeight: 600, textDecoration: "none", minHeight: 44 }}>
                      <RiBookOpenLine /> Ο πλήρης οδηγός στο Wiki
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
@keyframes gf-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.gf-step{animation:gf-in .18s ease-out both}
@media (prefers-reduced-motion: reduce){.gf-step{animation:none}}`}</style>
    </Modal>
  );
}

function ClosePrompt({ hasDraft, onKeep, onDiscard, onBack }: { hasDraft: boolean; onKeep: () => void; onDiscard: () => void; onBack: () => void }) {
  return (
    <div role="alertdialog" aria-labelledby="gf-close-title" style={{ display: "flex", flexDirection: "column", gap: 14, padding: "6px 0" }}>
      <div id="gf-close-title" style={{ fontSize: "var(--fs-16)", fontWeight: 800, color: "var(--foreground)" }}>
        {hasDraft ? "Να κρατήσουμε πρόχειρο;" : "Έχετε αλλαγές που δεν αποθηκεύτηκαν."}
      </div>
      <p style={{ margin: 0, fontSize: "var(--fs-13-5)", color: "var(--muted-foreground)", lineHeight: 1.5 }}>
        {hasDraft ? "Μπορείτε να συνεχίσετε από το ίδιο σημείο την επόμενη φορά που θα ανοίξετε αυτή την καταχώριση (έως 7 ημέρες)." : "Αν κλείσετε τώρα, ό,τι συμπληρώσατε θα χαθεί."}
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
        <button type="button" onClick={onBack} style={ghostBtn}>Πίσω</button>
        <button type="button" onClick={onDiscard} style={{ ...ghostBtn, color: "var(--color-danger)", borderColor: "color-mix(in srgb, var(--color-danger) 40%, transparent)" }}>{hasDraft ? "Απόρριψη" : "Κλείσιμο χωρίς αποθήκευση"}</button>
        {hasDraft && <button type="button" onClick={onKeep} style={primaryBtn}>Ναι, κράτησέ το</button>}
      </div>
    </div>
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

const linkBtn: React.CSSProperties = { background: "none", border: "none", color: "var(--muted-foreground)", fontSize: "var(--fs-12-5)", cursor: "pointer", padding: 0, textDecoration: "underline", font: "inherit" };
const ghostBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, minHeight: 40, padding: "9px 16px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--card)", cursor: "pointer", fontSize: "var(--fs-13)", color: "var(--foreground)" };
const primaryBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, minHeight: 40, padding: "9px 18px", borderRadius: 6, border: "none", background: "var(--color-primary)", color: "#fff", cursor: "pointer", fontSize: "var(--fs-13)", fontWeight: 600 };
const ghostSmall: React.CSSProperties = { ...ghostBtn, minHeight: 36, padding: "6px 12px", fontSize: "var(--fs-12-5)" };
const primarySmall: React.CSSProperties = { ...primaryBtn, minHeight: 36, padding: "6px 12px", fontSize: "var(--fs-12-5)" };
const errBox: React.CSSProperties = { padding: "8px 12px", borderRadius: 6, background: "var(--danger-soft)", color: "var(--color-danger)", fontSize: "var(--fs-12-5)", border: "1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)", marginBottom: 12 };
