import { env } from "@/lib/env";
import { logAPIUsage } from "@/lib/api-costs";
import type { AgentTool } from "@/lib/ai/agents";

export type AgentMessage = { role: "system" | "user" | "assistant" | "tool"; content: string; tool_call_id?: string };

const ENDPOINT = "https://api.deepseek.com/v1/chat/completions";

export function buildRequestBody(opts: { system: string; messages: AgentMessage[]; tools?: AgentTool[]; model: string }) {
  const messages = [{ role: "system" as const, content: opts.system }, ...opts.messages];
  const body: Record<string, unknown> = {
    model: opts.model,
    messages,
    stream: true,
    stream_options: { include_usage: true },
  };
  if (opts.tools && opts.tools.length) {
    body.tools = opts.tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } }));
  }
  return body as { model: string; messages: AgentMessage[]; stream: boolean; tools?: unknown[] };
}

const enc = new TextEncoder();
const sse = (event: string, data: unknown) => enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

/** Stream a DeepSeek completion as a normalized SSE stream (token/tool/done/error).
 *  Does not execute tools. Logs cost on completion. */
export function runAgentStream(opts: { system: string; messages: AgentMessage[]; tools?: AgentTool[]; model?: string }): ReadableStream<Uint8Array> {
  const model = opts.model ?? "deepseek-chat";
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      if (!env.DEEPSEEK_API_KEY) {
        controller.enqueue(sse("error", { message: "Το κλειδί DeepSeek δεν έχει ρυθμιστεί." }));
        controller.enqueue(sse("done", {}));
        controller.close();
        return;
      }
      let tokensUsed = 0;
      try {
        const res = await fetch(ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.DEEPSEEK_API_KEY}` },
          body: JSON.stringify(buildRequestBody({ system: opts.system, messages: opts.messages, tools: opts.tools, model })),
        });
        if (!res.ok || !res.body) {
          controller.enqueue(sse("error", { message: `DeepSeek error ${res.status}` }));
          await logAPIUsage({ apiName: "deepseek", endpoint: "/chat/completions", model, status: "FAILED", errorMessage: `HTTP ${res.status}` });
          controller.enqueue(sse("done", {}));
          controller.close();
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
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
            let json: any;
            try { json = JSON.parse(payload); } catch { continue; }
            if (json.usage?.total_tokens) tokensUsed = json.usage.total_tokens;
            const choice = json.choices?.[0];
            const delta = choice?.delta;
            if (delta?.content) controller.enqueue(sse("token", { delta: delta.content }));
            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                controller.enqueue(sse("tool", { id: tc.id ?? `idx-${tc.index ?? 0}`, name: tc.function?.name, argsDelta: tc.function?.arguments ?? "" }));
              }
            }
          }
        }
        await logAPIUsage({ apiName: "deepseek", endpoint: "/chat/completions", model, tokensUsed, status: "SUCCESS" });
        controller.enqueue(sse("done", {}));
        controller.close();
      } catch (e) {
        controller.enqueue(sse("error", { message: e instanceof Error ? e.message : "Άγνωστο σφάλμα" }));
        controller.enqueue(sse("done", {}));
        controller.close();
      }
    },
  });
}
