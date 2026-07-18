"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import {
  RiCustomerService2Line,
  RiCloseLine,
  RiCheckboxCircleLine,
  RiAttachment2,
  RiLoaderLine,
  RiExternalLinkLine,
} from "react-icons/ri";

const MAX_FILES = 3;
const MAX_FILE_MB = 5;
const MAX_TOTAL_MB = 15;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

const ERROR_TEXT: Record<string, string> = {
  invalid_subject: "Το θέμα είναι υποχρεωτικό (έως 200 χαρακτήρες).",
  invalid_body: "Η περιγραφή είναι υποχρεωτική (έως 5000 χαρακτήρες).",
  too_many_files: `Έως ${MAX_FILES} εικόνες.`,
  invalid_file_type: "Επιτρέπονται μόνο εικόνες JPG, PNG ή WebP.",
  file_too_large: `Κάθε αρχείο έως ${MAX_FILE_MB}MB.`,
  files_too_large: `Συνολικό μέγεθος έως ${MAX_TOTAL_MB}MB.`,
  rate_limited: "Πολλά αιτήματα — δοκιμάστε ξανά σε λίγη ώρα.",
  invalid_key: "Μη έγκυρο κλειδί υποστήριξης (TICKETING_API_KEY) — ενημερώστε τον διαχειριστή.",
  unknown_source: "Άγνωστος κωδικός project (TICKETING_PROJECT_CODE) — ενημερώστε τον διαχειριστή.",
  missing_credentials: "Λείπουν τα διαπιστευτήρια υποστήριξης — ενημερώστε τον διαχειριστή.",
  forbidden_origin: "Το domain δεν επιτρέπεται στην υπηρεσία υποστήριξης — ενημερώστε τον διαχειριστή.",
  ticketing_not_configured: "Η υπηρεσία υποστήριξης δεν έχει ρυθμιστεί ακόμη.",
  ticketing_unreachable: "Η υπηρεσία υποστήριξης δεν είναι διαθέσιμη — δοκιμάστε ξανά.",
};

type Done = { code: string; statusUrl: string; attachments?: number; duplicate?: boolean };

export function SupportTicketWidget({ userName }: { userName: string }) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [pending, start] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open]);

  function reset() {
    setSubject(""); setBody(""); setFiles([]); setError(null); setDone(null);
  }

  function pickFiles(list: FileList | null) {
    if (!list) return;
    setError(null);
    const next = [...files, ...Array.from(list)].slice(0, MAX_FILES);
    if (next.some((f) => !ACCEPTED.includes(f.type))) return setError(ERROR_TEXT.invalid_file_type);
    if (next.some((f) => f.size > MAX_FILE_MB * 1024 * 1024)) return setError(ERROR_TEXT.file_too_large);
    if (next.reduce((s, f) => s + f.size, 0) > MAX_TOTAL_MB * 1024 * 1024) return setError(ERROR_TEXT.files_too_large);
    setFiles(next);
  }

  const canSubmit = subject.trim().length > 0 && body.trim().length > 0 && !pending;

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit) return;
    const honeypot = (new FormData(e.currentTarget).get("website") as string) || "";
    setError(null);
    start(async () => {
      try {
        const fd = new FormData();
        fd.set("website", honeypot);
        fd.set("subject", subject.trim());
        fd.set("body", body.trim());
        fd.set("originUrl", window.location.href);
        for (const f of files) fd.append("files", f);
        const res = await fetch("/api/support", { method: "POST", body: fd });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.code) setDone(data);
        else setError(ERROR_TEXT[data.error] ?? "Κάτι πήγε στραβά — δοκιμάστε ξανά.");
      } catch {
        setError("Κάτι πήγε στραβά — δοκιμάστε ξανά.");
      }
    });
  }

  const input: React.CSSProperties = {
    width: "100%", padding: "10px 12px", borderRadius: 8, fontSize: 14,
    border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)",
    outline: "none", fontFamily: "inherit",
  };
  const label: React.CSSProperties = {
    fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)",
    textTransform: "uppercase", letterSpacing: ".04em", display: "block", marginBottom: 6,
  };

  return (
    <>
      {/* Dashboard card */}
      <div style={{
        background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)",
        padding: "20px 24px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
      }}>
        <RiCustomerService2Line style={{ fontSize: 26, color: "var(--color-primary)", flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)" }}>Υποστήριξη DGsmart</div>
          <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 2 }}>
            Αντιμετωπίζετε πρόβλημα με την εφαρμογή; Στείλτε αίτημα στην ομάδα υποστήριξης.
          </div>
        </div>
        <a href="/staff/support" style={{
          padding: "9px 16px", borderRadius: 8, border: "1px solid var(--border)", cursor: "pointer",
          background: "var(--card)", color: "var(--foreground)", fontSize: 13.5, fontWeight: 600,
          flexShrink: 0, textDecoration: "none",
        }}>
          Τα αιτήματά μας
        </a>
        <button type="button" onClick={() => { reset(); setOpen(true); }} style={{
          padding: "9px 18px", borderRadius: 8, border: "none", cursor: "pointer",
          background: "var(--color-primary)", color: "#fff", fontSize: 13.5, fontWeight: 600, flexShrink: 0,
        }}>
          Νέο αίτημα
        </button>
      </div>

      {open && typeof document !== "undefined" && createPortal(
        <div
          role="dialog" aria-modal="true" aria-label="Αίτημα υποστήριξης"
          onClick={() => setOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,.45)",
            backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "max(16px, env(safe-area-inset-top)) 16px",
          }}
        >
          <style>{`@keyframes supportModalIn { from { opacity: 0; transform: translateY(12px) scale(.985); } to { opacity: 1; transform: none; } }`}</style>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: 540, maxHeight: "min(720px, calc(100dvh - 32px))",
              display: "flex", flexDirection: "column", background: "var(--card)",
              borderRadius: 14, border: "1px solid var(--border)",
              boxShadow: "0 32px 70px -24px rgba(0,0,0,.45)", overflow: "hidden",
              animation: "supportModalIn .2s ease-out",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, padding: "20px 24px 14px", borderBottom: "1px solid var(--border)", flex: "none" }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 700, color: "var(--foreground)" }}>Αίτημα υποστήριξης</div>
                <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 3 }}>
                  Υποβάλλεται ως <b>{userName}</b> — θα λάβετε email επιβεβαίωσης με link παρακολούθησης.
                </div>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Κλείσιμο" style={{ border: "1px solid var(--border)", background: "var(--card)", borderRadius: 8, padding: 6, cursor: "pointer", color: "var(--foreground)", lineHeight: 0, flex: "none" }}>
                <RiCloseLine size={18} />
              </button>
            </div>

            {done ? (
              <div style={{ textAlign: "center", padding: "38px 26px 30px", overflowY: "auto" }}>
                <RiCheckboxCircleLine size={50} style={{ color: "var(--color-success)" }} />
                <div style={{ fontSize: 18, fontWeight: 700, marginTop: 12, color: "var(--foreground)" }}>
                  {done.duplicate ? "Το αίτημα υπάρχει ήδη" : "Το αίτημα καταχωρήθηκε"}
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, marginTop: 8, color: "var(--color-primary)" }}>{done.code}</div>
                {typeof done.attachments === "number" && done.attachments > 0 && (
                  <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 6 }}>
                    Επισυνάφθηκαν {done.attachments} {done.attachments === 1 ? "αρχείο" : "αρχεία"}.
                  </div>
                )}
                <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 8 }}>
                  Θα λάβετε email με κάθε ενημέρωση της πορείας του.
                </div>
                <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 20 }}>
                  <a href={done.statusUrl} target="_blank" rel="noopener noreferrer" style={{
                    display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 18px", borderRadius: 8,
                    border: "1px solid var(--border)", color: "var(--foreground)", fontSize: 13.5, fontWeight: 600, textDecoration: "none",
                  }}>
                    Παρακολούθηση <RiExternalLinkLine />
                  </a>
                  <button type="button" onClick={() => setOpen(false)} style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: "var(--color-primary)", color: "#fff", fontWeight: 600, fontSize: 13.5, cursor: "pointer" }}>
                    Κλείσιμο
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", flex: "1 1 auto", minHeight: 0 }}>
                <div style={{ overflowY: "auto", padding: "18px 24px", flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column", gap: 16 }}>
                  <input name="website" className="hidden" tabIndex={-1} autoComplete="off" style={{ display: "none" }} />

                  <div>
                    <label style={label} htmlFor="support-subject">Θέμα</label>
                    <input id="support-subject" required maxLength={200} value={subject} onChange={(e) => setSubject(e.target.value)}
                      placeholder="π.χ. Σφάλμα κατά την έκδοση κοινοχρήστων" style={input} />
                  </div>

                  <div>
                    <label style={label} htmlFor="support-body">Περιγραφή</label>
                    <textarea id="support-body" required maxLength={5000} rows={6} value={body} onChange={(e) => setBody(e.target.value)}
                      placeholder="Περιγράψτε το πρόβλημα — τι κάνατε, τι περιμένατε, τι συνέβη…" style={{ ...input, resize: "vertical" }} />
                    <div style={{ fontSize: 11.5, color: "var(--muted-foreground)", marginTop: 4, textAlign: "right" }}>{body.length}/5000</div>
                  </div>

                  <div>
                    <label style={label}>Στιγμιότυπα οθόνης (προαιρετικά)</label>
                    <input ref={fileInput} type="file" accept={ACCEPTED.join(",")} multiple style={{ display: "none" }}
                      onChange={(e) => { pickFiles(e.target.files); e.target.value = ""; }} />
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                      {files.map((f, i) => (
                        <span key={`${f.name}-${i}`} style={{
                          display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px",
                          borderRadius: 20, background: "var(--bg-canvas)", border: "1px solid var(--border)",
                          fontSize: 12.5, color: "var(--foreground)", maxWidth: 220,
                        }}>
                          <RiAttachment2 style={{ flexShrink: 0 }} />
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                          <button type="button" aria-label={`Αφαίρεση ${f.name}`} onClick={() => setFiles(files.filter((_, j) => j !== i))}
                            style={{ border: "none", background: "none", cursor: "pointer", color: "var(--muted-foreground)", lineHeight: 0, padding: 0 }}>
                            <RiCloseLine size={15} />
                          </button>
                        </span>
                      ))}
                      {files.length < MAX_FILES && (
                        <button type="button" onClick={() => fileInput.current?.click()} style={{
                          display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8,
                          border: "1px dashed var(--border)", background: "transparent", cursor: "pointer",
                          fontSize: 12.5, color: "var(--muted-foreground)",
                        }}>
                          <RiAttachment2 /> Προσθήκη εικόνας
                        </button>
                      )}
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--muted-foreground)", marginTop: 6 }}>
                      Έως {MAX_FILES} εικόνες (JPG/PNG/WebP), {MAX_FILE_MB}MB η καθεμία.
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div style={{ padding: "14px 24px", borderTop: "1px solid var(--border)", flex: "none", display: "flex", alignItems: "center", gap: 12 }}>
                  {error && <div style={{ fontSize: 12.5, color: "var(--color-danger)", flex: 1 }}>{error}</div>}
                  <button type="submit" disabled={!canSubmit} style={{
                    marginLeft: "auto", padding: "11px 24px", borderRadius: 8, border: "none",
                    background: canSubmit ? "var(--color-primary)" : "var(--muted-foreground)",
                    color: "#fff", fontWeight: 600, fontSize: 14,
                    cursor: canSubmit ? "pointer" : "not-allowed",
                    display: "inline-flex", alignItems: "center", gap: 8,
                  }}>
                    {pending && <RiLoaderLine className="animate-spin" />}
                    {pending ? "Αποστολή…" : "Αποστολή αιτήματος"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
