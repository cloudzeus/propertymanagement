"use client";

import { useEffect, useRef } from "react";
import { RiLoader4Line, RiCheckLine, RiErrorWarningLine } from "react-icons/ri";
import { Markdown } from "@/components/cms/Markdown";
import { ConfirmCard } from "./ConfirmCard";
import type { AssistantMessage } from "./reducer";

export function MessageList({ messages, streaming, onConfirm, onCancel }: { messages: AssistantMessage[]; streaming: boolean; onConfirm: (id: string) => Promise<void>; onCancel: (id: string) => Promise<void> }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [messages, streaming]);
  return (
    <>
      {messages.map((m) => {
        if (m.role === "user") return <div key={m.id} className="ast-msg ast-msg--user">{m.content}</div>;
        if (m.role === "tool") return <div key={m.id} className="ast-msg ast-msg--tool">{m.content}</div>;
        const empty = !m.content && !m.tools.length && !m.confirm;
        return (
          <div key={m.id} className="ast-msg ast-msg--assistant">
            {m.tools.length > 0 && (
              <div className="ast-chips" style={{ marginBottom: m.content ? 8 : 0 }}>
                {m.tools.map((t, i) => (
                  <span key={i} className={`ast-chip ast-chip--${t.state}`}>
                    {t.state === "running" ? <RiLoader4Line /> : t.state === "done" ? <RiCheckLine /> : <RiErrorWarningLine />} {t.label}
                  </span>
                ))}
              </div>
            )}
            {m.content ? <Markdown>{m.content}</Markdown> : empty && streaming ? <span className="ast-chip ast-chip--running"><RiLoader4Line /> Σκέφτομαι…</span> : null}
            {m.confirm && <div style={{ marginTop: 8 }}><ConfirmCard card={m.confirm} onConfirm={onConfirm} onCancel={onCancel} /></div>}
          </div>
        );
      })}
      <div ref={endRef} />
    </>
  );
}
