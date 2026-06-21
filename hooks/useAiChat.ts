"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { parseAgentSse, accumulateTool, type SseState, type ToolAccumulator } from "@/lib/ai/sse";

export type ChatMessage = { id: string; role: "user" | "assistant"; content: string };

let _id = 0;
const nextId = () => `m${++_id}`;

export function useAiChat(opts: { endpoint?: string; agentKey: string; onToolCall?: (name: string, args: unknown) => void }) {
  const endpoint = opts.endpoint ?? "/api/ai/agent";
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toolArgs = useRef<ToolAccumulator>(new Map());
  const abortRef = useRef<AbortController | null>(null);

  // Abort any in-flight stream when the component unmounts.
  useEffect(() => () => abortRef.current?.abort(), []);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setError(null);
    const userMsg: ChatMessage = { id: nextId(), role: "user", content: text };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput("");
    setIsStreaming(true);

    const assistantId = nextId();
    setMessages((m) => [...m, { id: assistantId, role: "assistant", content: "" }]);
    toolArgs.current.clear();

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentKey: opts.agentKey, messages: history.map((m) => ({ role: m.role, content: m.content })) }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) { setError(`Σφάλμα ${res.status}`); setIsStreaming(false); return; }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let state: SseState = { buffer: "" };
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const { events, state: next } = parseAgentSse(decoder.decode(value, { stream: true }), state);
        state = next;
        for (const ev of events) {
          if (ev.type === "token") {
            setMessages((m) => m.map((x) => (x.id === assistantId ? { ...x, content: x.content + ev.delta } : x)));
          } else if (ev.type === "tool") {
            const completed = accumulateTool(toolArgs.current, ev);
            if (completed) opts.onToolCall?.(completed.name, completed.args);
          } else if (ev.type === "error") {
            setError(ev.message);
          }
        }
      }
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return; // unmounted / cancelled — not an error
      setError(e instanceof Error ? e.message : "Σφάλμα σύνδεσης");
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setIsStreaming(false);
    }
  }, [endpoint, input, isStreaming, messages, opts]);

  return { messages, input, setInput, send, isStreaming, error };
}
