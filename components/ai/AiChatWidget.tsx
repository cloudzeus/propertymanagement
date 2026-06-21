"use client";

import { useEffect, useRef, useState } from "react";
import { RiRobot2Line, RiCloseLine, RiSendPlane2Line, RiArrowDownLine, RiCheckLine } from "react-icons/ri";
import { useAiChat } from "@/hooks/useAiChat";

export type AppliedBadge = { id: string; label: string };

export function AiChatWidget({
  agentKey, onToolCall, title = "Βοηθός AI", greeting, quickReplies = [],
}: { agentKey: string; onToolCall: (name: string, args: unknown) => void; title?: string; greeting?: string; quickReplies?: string[] }) {
  const [open, setOpen] = useState(true);
  const [badges, setBadges] = useState<AppliedBadge[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);

  const { messages, input, setInput, send, isStreaming, error, retry } = useAiChat({
    agentKey,
    onToolCall: (name, args) => {
      onToolCall(name, args);
      // applied badges: summarize changed keys
      const keys = args && typeof args === "object" ? Object.keys(args as object) : [];
      const label = keys.length ? keys.slice(0, 3).join(", ") : "ενημερώθηκε";
      setBadges((b) => [...b.slice(-4), { id: `${Date.now()}-${b.length}`, label }]);
    },
  });

  // auto-scroll
  useEffect(() => {
    const el = scrollRef.current; if (!el) return;
    if (atBottom) el.scrollTop = el.scrollHeight;
  }, [messages, atBottom]);
  const onScroll = () => {
    const el = scrollRef.current; if (!el) return;
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 40);
  };

  const lastAssistant = messages[messages.length - 1];
  const showTyping = isStreaming && (!lastAssistant || lastAssistant.role !== "assistant" || lastAssistant.content === "");

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{ position: "fixed", right: 20, bottom: 20, zIndex: 60, width: 56, height: 56, borderRadius: "50%", background: "#0a7", color: "#fff", border: "none", boxShadow: "0 8px 24px rgba(0,0,0,.2)", fontSize: 24, cursor: "pointer" }} aria-label="Άνοιγμα βοηθού">
        <RiRobot2Line />
      </button>
    );
  }

  return (
    <div style={{ position: "fixed", right: 20, bottom: 20, zIndex: 60, width: 340, height: 440, background: "#fff", border: "1px solid #d4d4d4", borderRadius: 14, boxShadow: "0 12px 32px rgba(0,0,0,.18)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ background: "linear-gradient(90deg,#0a7,#0a8a6a)", color: "#fff", padding: "10px 12px", fontWeight: 600, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ display: "flex", gap: 6, alignItems: "center" }}><RiRobot2Line /> {title}</span>
        <button onClick={() => setOpen(false)} aria-label="Κλείσιμο" style={{ background: "none", border: "none", color: "#fff", cursor: "pointer" }}><RiCloseLine /></button>
      </div>

      <div ref={scrollRef} onScroll={onScroll} style={{ flex: 1, overflowY: "auto", padding: 10, fontSize: 13, lineHeight: 1.5, background: "#fafafa", position: "relative" }}>
        {messages.length === 0 && greeting && <div style={{ marginBottom: 8 }}><Bubble role="assistant">{greeting}</Bubble></div>}
        {messages.map((m) => (
          <div key={m.id} style={{ marginBottom: 8, textAlign: m.role === "user" ? "right" : "left" }}>
            {m.role === "user"
              ? <Bubble role="user">{m.content}</Bubble>
              : <AssistantBubble content={m.content || (isStreaming ? "…" : "")} onSelect={(s) => send(s)} />}
          </div>
        ))}
        {showTyping && <div style={{ marginBottom: 8 }}><Bubble role="assistant"><Dots /></Bubble></div>}
        {badges.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
            {badges.map((b) => <span key={b.id} style={{ background: "#ecfdf5", color: "#0a7", borderRadius: 8, padding: "3px 8px", fontSize: 11, display: "inline-flex", alignItems: "center", gap: 3 }}><RiCheckLine /> {b.label}</span>)}
          </div>
        )}
        {error && (
          <div style={{ marginTop: 8, color: "#c00", fontSize: 12 }}>
            {error} <button onClick={retry} style={{ color: "#0a7", background: "none", border: "none", cursor: "pointer" }}>Ξανά</button>
          </div>
        )}
      </div>

      {!atBottom && (
        <button onClick={() => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight; setAtBottom(true); }} style={{ position: "absolute", right: 14, bottom: 70, background: "#0a7", color: "#fff", border: "none", borderRadius: 14, padding: "4px 10px", fontSize: 11, cursor: "pointer" }}>
          <RiArrowDownLine /> νέο μήνυμα
        </button>
      )}

      {messages.length === 0 && quickReplies.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: "0 10px 8px" }}>
          {quickReplies.map((q) => <button key={q} onClick={() => send(q)} style={{ border: "1px solid #0a7", color: "#0a7", background: "none", borderRadius: 14, padding: "4px 10px", fontSize: 12, cursor: "pointer" }}>{q}</button>)}
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); send(); }} style={{ display: "flex", gap: 6, padding: 8, borderTop: "1px solid #eee" }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Μήνυμα…" disabled={isStreaming} style={{ flex: 1 }} />
        <button type="submit" disabled={isStreaming || !input.trim()} aria-label="Αποστολή"><RiSendPlane2Line /></button>
      </form>
    </div>
  );
}

function Bubble({ role, children }: { role: "user" | "assistant"; children: React.ReactNode }) {
  return <span style={{ display: "inline-block", padding: "6px 10px", borderRadius: 12, background: role === "user" ? "#0a7" : "#fff", color: role === "user" ? "#fff" : "#1a1a1a", border: role === "user" ? "none" : "1px solid #eee", maxWidth: "85%", textAlign: "left" }}>{children}</span>;
}

// Render assistant text with **bold** markdown.
function renderInline(text: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? <b key={i}>{p.slice(2, -2)}</b> : <span key={i}>{p}</span>,
  );
}

// A line is a selectable option if it starts with a bullet or a number.
const OPTION_RE = /^\s*(?:[•\-*]|\d+[.)])\s+(.+)$/;
// Keep a short, sendable label: drop the "→ CODE" mapping and any parenthetical explanation.
function optionLabel(raw: string): string {
  return raw.replace(/\*\*/g, "").split("→")[0].replace(/\([^)]*\)/g, "").trim().replace(/[:：]\s*$/, "");
}

// Assistant bubble: markdown-rendered text + clickable chips for any option list it contains.
function AssistantBubble({ content, onSelect }: { content: string; onSelect: (s: string) => void }) {
  const lines = content.split("\n");
  const options: string[] = [];
  for (const ln of lines) { const m = ln.match(OPTION_RE); if (m) { const l = optionLabel(m[1]); if (l) options.push(l); } }
  return (
    <span style={{ display: "inline-block", padding: "6px 10px", borderRadius: 12, background: "#fff", color: "#1a1a1a", border: "1px solid #eee", maxWidth: "90%", textAlign: "left" }}>
      {lines.map((ln, i) => <div key={i} style={{ minHeight: ln ? undefined : 6 }}>{renderInline(ln)}</div>)}
      {options.length > 0 && (
        <span style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
          {options.map((o, i) => (
            <button key={i} onClick={() => onSelect(o)} style={{ border: "1px solid #0a7", color: "#0a7", background: "#f0fdf9", borderRadius: 14, padding: "3px 10px", fontSize: 12, cursor: "pointer" }}>{o}</button>
          ))}
        </span>
      )}
    </span>
  );
}
function Dots() {
  return <span style={{ letterSpacing: 3, color: "#999" }}>● ● ●</span>;
}
