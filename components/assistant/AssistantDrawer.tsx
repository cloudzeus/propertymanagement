"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { RiRobot2Line, RiCloseLine, RiHistoryLine, RiAddLine, RiSendPlaneLine, RiArrowLeftLine } from "react-icons/ri";
import { useAssistantChat } from "@/hooks/useAssistantChat";
import { MessageList } from "./MessageList";
import { ConversationList } from "./ConversationList";
import { SuggestedPrompts } from "./SuggestedPrompts";
import "./assistant.css";

/** Open the assistant (optionally with a prefilled prompt). */
export const ASSISTANT_EVENT = "orithon:assistant";
/** Open the help drawer for the current page. */
export const HELP_EVENT = "orithon:help";
/** Fired by whichever drawer opens; the other one closes. detail: { which: "assistant" | "help" } */
export const DRAWER_OPEN_EVENT = "orithon:drawer-open";

const DEFAULT_PROMPTS: Record<string, string[]> = {
  company: ["Ποιες βλάβες είναι ανοιχτές σήμερα;", "Πώς στέλνω αίτημα προσφοράς σε συνεργάτες;", "Δείξε μου τα κτήρια που διαχειριζόμαστε."],
  customer: ["Τι χρωστάω σε κοινόχρηστα;", "Πώς δηλώνω βλάβη με φωτογραφία;", "Ποιες ανακοινώσεις υπάρχουν στο κτήριό μου;"],
  marketplace: ["Ποια αιτήματα προσφοράς εκκρεμούν;", "Πώς υποβάλλω προσφορά;", "Ποιες εργασίες μού έχουν ανατεθεί;"],
};

/** Floating assistant: FAB bottom-right + right drawer (bottom sheet on phones). Mounted once in AppShell. */
export function AssistantDrawer({ surface }: { surface: "company" | "customer" | "marketplace" }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const page = { path: pathname, search: search?.toString() ? `?${search}` : "" };
  const chat = useAssistantChat({ page });
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"chat" | "history">("chat");
  const [prompts, setPrompts] = useState<string[]>(DEFAULT_PROMPTS[surface]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { send, setInput, refreshConversations } = chat;

  // Page-specific suggestions from the wiki article of the current route.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/help/article?path=${encodeURIComponent(pathname)}&fields=prompts`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { prompts?: string[] } | null) => { if (!cancelled) setPrompts(j?.prompts?.length ? j.prompts : DEFAULT_PROMPTS[surface]); })
      .catch(() => { if (!cancelled) setPrompts(DEFAULT_PROMPTS[surface]); });
    return () => { cancelled = true; };
  }, [pathname, search, surface]);

  const announceOpen = () => window.dispatchEvent(new CustomEvent(DRAWER_OPEN_EVENT, { detail: { which: "assistant" } }));

  // Other components (Help drawer) open the assistant with an optional prompt; only one drawer stays open.
  useEffect(() => {
    const onOpen = (e: Event) => {
      const prompt = (e as CustomEvent<{ prompt?: string }>).detail?.prompt;
      setOpen(true); setView("chat"); announceOpen();
      if (prompt) { setInput(prompt); setTimeout(() => inputRef.current?.focus(), 50); }
    };
    const onOther = (e: Event) => { if ((e as CustomEvent<{ which?: string }>).detail?.which !== "assistant") setOpen(false); };
    window.addEventListener(ASSISTANT_EVENT, onOpen);
    window.addEventListener(DRAWER_OPEN_EVENT, onOther);
    return () => { window.removeEventListener(ASSISTANT_EVENT, onOpen); window.removeEventListener(DRAWER_OPEN_EVENT, onOther); };
  }, [setInput]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const toggle = useCallback(() => {
    setOpen((v) => !v);
    if (!open) announceOpen();
  }, [open]);

  const openHistory = async () => { await refreshConversations(); setView("history"); };
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } };

  return (
    <>
      <button type="button" className="ast-fab ast-fab--assistant" onClick={toggle} aria-expanded={open} title="Βοηθός Orithon" aria-label="Βοηθός Orithon">
        {open ? <RiCloseLine /> : <RiRobot2Line />}
      </button>
      {open && (
        <>
          <div className="ast-backdrop" onClick={() => setOpen(false)} />
          <aside className="ast-drawer" role="dialog" aria-label="Βοηθός Orithon">
            <div className="ast-head">
              {view === "history" ? (
                <button type="button" className="ast-iconbtn" onClick={() => setView("chat")} title="Πίσω" aria-label="Πίσω"><RiArrowLeftLine /></button>
              ) : null}
              <h2><RiRobot2Line style={{ color: "var(--color-accent)" }} /> {view === "history" ? "Ιστορικό" : "Βοηθός Orithon"}</h2>
              {view === "chat" && <button type="button" className="ast-iconbtn" onClick={openHistory} title="Ιστορικό συνομιλιών" aria-label="Ιστορικό"><RiHistoryLine /></button>}
              {view === "chat" && <button type="button" className="ast-iconbtn" onClick={chat.newConversation} title="Νέα συνομιλία" aria-label="Νέα συνομιλία"><RiAddLine /></button>}
              <button type="button" className="ast-iconbtn" onClick={() => setOpen(false)} title="Κλείσιμο" aria-label="Κλείσιμο"><RiCloseLine /></button>
            </div>
            <div className="ast-body">
              {view === "history" ? (
                <ConversationList rows={chat.conversations} activeId={chat.state.conversationId} onOpen={async (id) => { await chat.loadConversation(id); setView("chat"); }} onDelete={(id) => void chat.removeConversation(id)} />
              ) : (
                <>
                  {chat.state.messages.length === 0 && (
                    <>
                      <div className="ast-empty">Ρωτήστε για τα κτήριά σας, τις βλάβες, τα κοινόχρηστα ή το «πώς γίνεται». Ο βοηθός εκτελεί ενέργειες μόνο μετά από επιβεβαίωση.</div>
                      <SuggestedPrompts prompts={prompts} onPick={(p) => void send(p)} />
                    </>
                  )}
                  <MessageList messages={chat.state.messages} streaming={chat.state.streaming} onConfirm={chat.confirm} onCancel={chat.cancel} />
                </>
              )}
            </div>
            {view === "chat" && (
              <div className="ast-foot">
                {chat.state.error && <div className="ast-error">{chat.state.error}</div>}
                <div className="ast-input">
                  <textarea ref={inputRef} rows={2} value={chat.input} onChange={(e) => setInput(e.target.value)} onKeyDown={onKeyDown} placeholder="Γράψτε την ερώτησή σας…" aria-label="Μήνυμα προς τον βοηθό" maxLength={4000} />
                  <button type="button" className="ast-iconbtn" style={{ width: 44, height: 44, minWidth: 44, background: "var(--color-primary)", color: "var(--color-accent)", borderColor: "var(--color-primary)" }} onClick={() => void send()} disabled={chat.state.streaming || !chat.input.trim()} title="Αποστολή" aria-label="Αποστολή"><RiSendPlaneLine /></button>
                </div>
                <div className="ast-note">Ο βοηθός εκτελεί ενέργειες μόνο μετά από επιβεβαίωση.</div>
              </div>
            )}
          </aside>
        </>
      )}
    </>
  );
}
