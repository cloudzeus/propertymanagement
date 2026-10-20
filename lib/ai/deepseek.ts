import { env } from "@/lib/env";
import { logAPIUsage } from "@/lib/api-costs";
import { buildRequestBody, type AgentMessage } from "@/lib/ai/agent";
import type { AgentTool } from "@/lib/ai/agents";

const ENDPOINT = "https://api.deepseek.com/v1/chat/completions";

export type StreamChatResult = { content: string; toolCalls: { id: string; name: string; args: string }[]; usage: number };

/** One streaming DeepSeek completion, assembled server-side: content tokens (via onToken) + complete tool calls (keyed by index). */
export async function streamChat(opts: {
  system: string; messages: AgentMessage[]; tools?: AgentTool[]; model?: string;
  userId?: string; customerId?: string; onToken?: (delta: string) => void;
}): Promise<StreamChatResult> {
  const model = opts.model ?? "deepseek-chat";
  if (!env.DEEPSEEK_API_KEY) throw new Error("deepseek_unavailable");
  const meta = { apiName: "deepseek", endpoint: "/chat/completions", model, userId: opts.userId, customerId: opts.customerId };
  const res = await fetch(ENDPOINT, {
    method: "POST", cache: "no-store",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.DEEPSEEK_API_KEY}` },
    body: JSON.stringify(buildRequestBody({ system: opts.system, messages: opts.messages, tools: opts.tools?.length ? opts.tools : undefined, model })),
  });
  if (!res.ok || !res.body) {
    await logAPIUsage({ ...meta, status: "FAILED", errorMessage: `HTTP ${res.status}` });
    throw new Error(`DeepSeek error ${res.status}`);
  }
  const calls = new Map<number, { id: string; name: string; args: string }>();
  let content = "", usage = 0, buf = "";
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const payload = t.slice(5).trim();
      if (payload === "[DONE]") continue;
      let json: { usage?: { total_tokens?: number }; choices?: { delta?: { content?: string; tool_calls?: { index?: number; id?: string; function?: { name?: string; arguments?: string } }[] } }[] };
      try { json = JSON.parse(payload); } catch { continue; }
      if (json.usage?.total_tokens) usage = json.usage.total_tokens;
      const delta = json.choices?.[0]?.delta;
      if (delta?.content) { content += delta.content; opts.onToken?.(delta.content); }
      for (const tc of delta?.tool_calls ?? []) {
        const idx = tc.index ?? 0;
        const cur = calls.get(idx) ?? { id: "", name: "", args: "" };
        calls.set(idx, { id: tc.id ?? cur.id, name: tc.function?.name ?? cur.name, args: cur.args + (tc.function?.arguments ?? "") });
      }
    }
  }
  await logAPIUsage({ ...meta, tokensUsed: usage, status: "SUCCESS" });
  return { content, usage, toolCalls: [...calls.entries()].sort((a, b) => a[0] - b[0]).map(([i, c]) => ({ id: c.id || `call_${i}`, name: c.name, args: c.args })) };
}
