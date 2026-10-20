"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { parseAgentSse, type SseState } from "@/lib/ai/sse";
import { reduce, initialState, nextId } from "@/components/assistant/reducer";
import { confirmAiAction, cancelAiAction, listMyConversations, getConversationMessages, deleteConversation, type ConversationRow } from "@/app/actions/ai-assistant";

const ERRORS: Record<number, string> = {
  402: "Το πορτοφόλι του πελάτη δεν έχει υπόλοιπο για AI.",
  429: "Πολλά μηνύματα — δοκιμάστε σε λίγο.",
};

/** Chat state for the assistant drawer: streams turns from /api/ai/assistant, confirms/cancels proposals via server actions. */
export function useAssistantChat(opts: { page: { path: string; search: string } }) {
  const [state, dispatch] = useReducer(reduce, initialState);
  const [input, setInput] = useState("");
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const pageRef = useRef(opts.page);
  pageRef.current = opts.page;

  useEffect(() => () => abortRef.current?.abort(), []);

  const send = useCallback(async (forced?: string) => {
    const text = (forced ?? input).trim();
    if (!text || state.streaming) return;
    const assistantId = nextId();
    dispatch({ type: "start_turn", userText: text, assistantId });
    setInput("");
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/ai/assistant", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({ conversationId: state.conversationId, message: text, page: pageRef.current }),
      });
      if (!res.ok || !res.body) { dispatch({ type: "fail", message: ERRORS[res.status] ?? `Σφάλμα ${res.status}` }); return; }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let sse: SseState = { buffer: "" };
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const r = parseAgentSse(decoder.decode(value, { stream: true }), sse);
        sse = r.state;
        for (const event of r.events) dispatch({ type: "sse", assistantId, event });
      }
      dispatch({ type: "sse", assistantId, event: { type: "done" } });
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      dispatch({ type: "fail", message: e instanceof Error ? e.message : "Σφάλμα σύνδεσης" });
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [input, state.streaming, state.conversationId]);

  // A server action that throws (network, session gone) still resolves the card: it must never stay "pending".
  const confirm = useCallback(async (actionId: string) => {
    let result: Awaited<ReturnType<typeof confirmAiAction>>;
    try { result = await confirmAiAction(actionId); } catch (e) { result = { ok: false, error: e instanceof Error ? e.message : "Η ενέργεια δεν ολοκληρώθηκε." }; }
    dispatch({ type: "confirm_result", actionId, result });
  }, []);

  const cancel = useCallback(async (actionId: string) => {
    let result: Awaited<ReturnType<typeof cancelAiAction>>;
    try { result = await cancelAiAction(actionId); } catch (e) { result = { ok: false, error: e instanceof Error ? e.message : "Η ακύρωση δεν ολοκληρώθηκε." }; }
    dispatch({ type: "cancel_result", actionId, result });
  }, []);

  const refreshConversations = useCallback(async () => { setConversations(await listMyConversations()); }, []);

  const loadConversation = useCallback(async (id: string) => {
    abortRef.current?.abort();
    dispatch({ type: "load", conversationId: id, messages: await getConversationMessages(id) });
  }, []);

  const removeConversation = useCallback(async (id: string) => {
    await deleteConversation(id);
    if (state.conversationId === id) dispatch({ type: "reset" });
    await refreshConversations();
  }, [state.conversationId, refreshConversations]);

  const newConversation = useCallback(() => { abortRef.current?.abort(); dispatch({ type: "reset" }); }, []);

  return { state, input, setInput, send, confirm, cancel, newConversation, loadConversation, removeConversation, conversations, refreshConversations };
}
