import { db } from "@/lib/db";
import type { EffectiveSession } from "@/lib/auth-effective";
import type { AgentMessage } from "@/lib/ai/agent";
import { deepseekComplete } from "@/lib/ai";

export const HISTORY_LIMIT = 20;
const SUMMARY_EVERY = 10;

export async function getOrCreateConversation(eff: EffectiveSession, input: { conversationId?: string | null; surface: string; pagePath: string }): Promise<{ id: string; isNew: boolean }> {
  if (input.conversationId) {
    const c = await db.aiConversation.findUnique({ where: { id: input.conversationId }, select: { id: true, userId: true } });
    if (c && c.userId === eff.user.id) {
      await db.aiConversation.update({ where: { id: c.id }, data: { pagePath: input.pagePath } });
      return { id: c.id, isNew: false };
    }
  }
  const row = await db.aiConversation.create({
    data: { userId: eff.user.id, actorId: eff.impersonatorId ?? null, role: eff.user.role as string, surface: input.surface, pagePath: input.pagePath },
    select: { id: true },
  });
  return { id: row.id, isNew: true };
}

export async function appendMessage(conversationId: string, m: { role: "user" | "assistant" | "tool"; content: string; toolCalls?: unknown; toolName?: string }): Promise<{ id: string }> {
  const row = await db.aiMessage.create({ data: { conversationId, role: m.role, content: m.content, toolCalls: m.toolCalls === undefined ? undefined : (m.toolCalls as object), toolName: m.toolName ?? null }, select: { id: true } });
  const conv = await db.aiConversation.findUnique({ where: { id: conversationId }, select: { title: true } });
  await db.aiConversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date(), ...(m.role === "user" && !conv?.title ? { title: m.content.trim().slice(0, 60) } : {}) },
  });
  return { id: row.id };
}

/** User/assistant turns the model sees (oldest → newest), prefixed by the rolling summary when present. */
export async function loadHistory(conversationId: string, limit = HISTORY_LIMIT): Promise<AgentMessage[]> {
  const [conv, rows] = await Promise.all([
    db.aiConversation.findUnique({ where: { id: conversationId }, select: { summary: true } }),
    db.aiMessage.findMany({ where: { conversationId, role: { in: ["user", "assistant"] } }, orderBy: { createdAt: "desc" }, take: limit, select: { role: true, content: true } }),
  ]);
  const msgs: AgentMessage[] = rows.reverse().filter((r) => r.content.trim()).map((r) => ({ role: r.role as "user" | "assistant", content: r.content }));
  if (conv?.summary) msgs.unshift({ role: "assistant", content: `Περίληψη προηγούμενης συζήτησης: ${conv.summary}` });
  return msgs;
}

/** Every SUMMARY_EVERY messages, condense the conversation so long chats stay cheap. */
export async function maybeSummarize(conversationId: string): Promise<void> {
  const count = await db.aiMessage.count({ where: { conversationId, role: { in: ["user", "assistant"] } } });
  if (count === 0 || count % SUMMARY_EVERY !== 0) return;
  const rows = await db.aiMessage.findMany({ where: { conversationId, role: { in: ["user", "assistant"] } }, orderBy: { createdAt: "asc" }, select: { role: true, content: true } });
  const transcript = rows.map((r) => `${r.role === "user" ? "Χρήστης" : "Βοηθός"}: ${r.content}`).join("\n").slice(-12000);
  try {
    const summary = await deepseekComplete(`Συνόψισε σε έως 600 χαρακτήρες, στα ελληνικά, τα ουσιώδη της παρακάτω συζήτησης (τι ζήτησε ο χρήστης, τι απαντήθηκε, τι εκκρεμεί):\n\n${transcript}`);
    if (summary?.trim()) await db.aiConversation.update({ where: { id: conversationId }, data: { summary: summary.trim().slice(0, 600) } });
  } catch { /* summaries are best-effort */ }
}
