import type { AgentEvent } from "@/lib/ai/sse";
import type { ConfirmCard } from "@/lib/ai/assistant/actions-core";
import type { ExecuteResult } from "@/lib/ai/tools/types";
import type { StoredMessage } from "@/app/actions/ai-assistant";

export type ToolChip = { name: string; label: string; state: "running" | "done" | "error" };
export type ConfirmState = ConfirmCard & { state: "pending" | "executed" | "cancelled" | "failed"; resultMessage?: string; href?: string };
export type AssistantMessage = { id: string; role: "user" | "assistant" | "tool"; content: string; tools: ToolChip[]; confirm?: ConfirmState };
export type ChatState = { conversationId: string | null; messages: AssistantMessage[]; streaming: boolean; error: string | null };

export type ChatAction =
  | { type: "start_turn"; userText: string; assistantId: string }
  | { type: "sse"; assistantId: string; event: AgentEvent }
  | { type: "confirm_result"; actionId: string; result: ExecuteResult }
  | { type: "cancelled"; actionId: string }
  | { type: "load"; conversationId: string; messages: StoredMessage[] }
  | { type: "reset" }
  | { type: "fail"; message: string };

export const initialState: ChatState = { conversationId: null, messages: [], streaming: false, error: null };

let seq = 0;
export const nextId = () => `a${++seq}-${Date.now().toString(36)}`;

const patch = (s: ChatState, id: string, f: (m: AssistantMessage) => AssistantMessage): ChatState => ({ ...s, messages: s.messages.map((m) => (m.id === id ? f(m) : m)) });
const patchConfirm = (s: ChatState, actionId: string, f: (c: ConfirmState) => ConfirmState): ChatState => ({
  ...s, messages: s.messages.map((m) => (m.confirm?.actionId === actionId ? { ...m, confirm: f(m.confirm) } : m)),
});

export function reduce(s: ChatState, a: ChatAction): ChatState {
  switch (a.type) {
    case "start_turn":
      return { ...s, error: null, streaming: true, messages: [...s.messages, { id: nextId(), role: "user", content: a.userText, tools: [] }, { id: a.assistantId, role: "assistant", content: "", tools: [] }] };
    case "sse": {
      const ev = a.event;
      switch (ev.type) {
        case "token": return patch(s, a.assistantId, (m) => ({ ...m, content: m.content + ev.delta }));
        case "tool_status": return patch(s, a.assistantId, (m) => {
          const i = m.tools.findIndex((t) => t.name === ev.name && t.state === "running");
          const chip: ToolChip = { name: ev.name, label: ev.label, state: ev.state };
          return { ...m, tools: i >= 0 && ev.state !== "running" ? m.tools.map((t, j) => (j === i ? chip : t)) : [...m.tools, chip] };
        });
        case "confirm": return patch(s, a.assistantId, (m) => ({ ...m, confirm: { ...ev.card, state: "pending" } }));
        case "meta": return { ...s, conversationId: ev.conversationId };
        case "done": return { ...s, streaming: false };
        case "error": return { ...s, streaming: false, error: ev.message };
        default: return s;
      }
    }
    case "confirm_result":
      return patchConfirm(s, a.actionId, (c) => (a.result.ok ? { ...c, state: "executed", resultMessage: a.result.message, href: a.result.href } : { ...c, state: "failed", resultMessage: a.result.error }));
    case "cancelled":
      return patchConfirm(s, a.actionId, (c) => ({ ...c, state: "cancelled" }));
    case "load":
      return { conversationId: a.conversationId, streaming: false, error: null, messages: a.messages.map((m) => ({ id: m.id, role: (m.role === "user" || m.role === "tool" ? m.role : "assistant") as AssistantMessage["role"], content: m.content, tools: [] })) };
    case "reset":
      return initialState;
    case "fail":
      return { ...s, streaming: false, error: a.message };
  }
}
