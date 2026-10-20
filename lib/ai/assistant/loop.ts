import type { EffectiveSession } from "@/lib/auth-effective";
import { streamChat } from "@/lib/ai/deepseek";
import type { AgentMessage } from "@/lib/ai/agent";
import type { AssistantCtx, WriteTool } from "@/lib/ai/tools/types";
import { findTool, toolsForRole, toAgentTools } from "@/lib/ai/tools/registry";
import { retrieveWiki } from "./retrieval";
import { buildSystemPrompt } from "./prompt";
import { appendMessage, loadHistory, maybeSummarize } from "./conversations";
import { proposeAction, expireStale } from "./actions";
import { truncateToolResult } from "./truncate";

export const MAX_ROUNDS = 4;
const enc = new TextEncoder();
const sse = (event: string, data: unknown) => enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
const PROPOSAL_NOTE = "Η προεπισκόπηση εμφανίστηκε στον χρήστη· περίμενε την επιβεβαίωσή του — μην ξανακαλέσεις το εργαλείο. Κλείσε με μία σύντομη πρόταση.";

/** One assistant turn as an SSE stream: tools run server-side; write tools become confirm cards (never executed here). */
export function runAssistantTurn(input: { eff: EffectiveSession; ctx: AssistantCtx; conversationId: string; userText: string }): ReadableStream<Uint8Array> {
  const { ctx, conversationId, userText } = input;
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: string, data: unknown) => controller.enqueue(sse(event, data));
      try {
        await expireStale();
        await appendMessage(conversationId, { role: "user", content: userText });
        const meta = { userId: ctx.user.id, customerId: ctx.user.customerId ?? undefined };
        const wiki = await retrieveWiki(userText, ctx.user.role, 5, meta);
        const system = buildSystemPrompt(ctx, wiki);
        const allowed = toolsForRole(ctx.user.role, ctx.perms);
        let tools = toAgentTools(allowed);
        const messages: AgentMessage[] = [...(await loadHistory(conversationId)), { role: "user", content: userText }];
        const transcriptCalls: unknown[] = [];
        let finalContent = "";

        for (let round = 0; round < MAX_ROUNDS; round++) {
          const res = await streamChat({ system, messages, tools, ...meta, onToken: (delta) => emit("token", { delta }) });
          finalContent += res.content;
          if (!res.toolCalls.length) break;

          messages.push({ role: "assistant", content: res.content, tool_calls: res.toolCalls.map((c) => ({ id: c.id, type: "function", function: { name: c.name, arguments: c.args } })) });
          let proposed = false;
          for (const call of res.toolCalls) {
            transcriptCalls.push({ name: call.name, args: call.args });
            const tool = findTool(call.name);
            const reply = (content: string) => messages.push({ role: "tool", content, tool_call_id: call.id });
            if (!tool || !allowed.some((t) => t.name === tool.name)) { reply(JSON.stringify({ error: "Άγνωστο εργαλείο" })); continue; }
            let args: unknown;
            try { args = call.args.trim() ? JSON.parse(call.args) : {}; } catch { reply(JSON.stringify({ error: "Μη έγκυρα ορίσματα" })); continue; }

            if (tool.kind === "read") {
              emit("tool_status", { name: tool.name, label: tool.label, state: "running" });
              const parsed = tool.schema.safeParse(args);
              if (!parsed.success) { emit("tool_status", { name: tool.name, label: tool.label, state: "error" }); reply(JSON.stringify({ error: "Μη έγκυρα ορίσματα" })); continue; }
              try {
                const result = await tool.run(parsed.data, ctx);
                emit("tool_status", { name: tool.name, label: tool.label, state: result.ok ? "done" : "error" });
                reply(truncateToolResult(result));
              } catch (e) {
                emit("tool_status", { name: tool.name, label: tool.label, state: "error" });
                reply(JSON.stringify({ error: e instanceof Error ? e.message : "Σφάλμα εργαλείου" }));
              }
            } else {
              if (proposed) { reply(JSON.stringify({ error: "Μία ενέργεια τη φορά — περίμενε την επιβεβαίωση της πρώτης." })); continue; }
              try {
                const p = await proposeAction(ctx, tool as WriteTool<unknown>, args, conversationId);
                if ("error" in p) { reply(JSON.stringify({ error: p.error })); continue; }
                proposed = true;
                emit("confirm", { card: p.card });
                reply(JSON.stringify({ proposed: true, note: PROPOSAL_NOTE }));
              } catch (e) {
                // A guard or lookup that throws inside preview is a tool error for the model, never a dead turn.
                reply(JSON.stringify({ error: e instanceof Error ? e.message : "Σφάλμα εργαλείου" }));
              }
            }
          }
          if (proposed) tools = [];
        }
        // The model used every round on tool calls: one last text-only call so the user never gets an empty bubble.
        if (!finalContent.trim()) {
          const last = await streamChat({ system, messages, tools: [], ...meta, onToken: (delta) => emit("token", { delta }) });
          finalContent += last.content;
        }

        const saved = await appendMessage(conversationId, { role: "assistant", content: finalContent, toolCalls: transcriptCalls.length ? transcriptCalls : undefined });
        await maybeSummarize(conversationId, meta);
        emit("meta", { conversationId, messageId: saved.id });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Άγνωστο σφάλμα";
        emit("error", { message: msg === "deepseek_unavailable" ? "Ο βοηθός δεν είναι διαθέσιμος αυτή τη στιγμή." : msg });
      } finally {
        emit("done", {});
        controller.close();
      }
    },
  });
}
