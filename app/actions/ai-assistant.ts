"use server";

import { db } from "@/lib/db";
import { getEffectiveSession } from "@/lib/auth-effective";
import { confirmAction, cancelAction } from "@/lib/ai/assistant/actions";
import type { ExecuteResult } from "@/lib/ai/tools/types";
import type { IndexResult } from "@/lib/ai/assistant/indexer";

async function requireEff() {
  const eff = await getEffectiveSession();
  if (!eff) throw new Error("Unauthorized");
  return eff;
}

export async function confirmAiAction(actionId: string): Promise<ExecuteResult> {
  const eff = await getEffectiveSession();
  if (!eff) return { ok: false, error: "Απαιτείται σύνδεση." };
  return confirmAction(actionId, eff);
}

export async function cancelAiAction(actionId: string): Promise<{ ok: boolean; error?: string }> {
  const eff = await getEffectiveSession();
  if (!eff) return { ok: false, error: "Απαιτείται σύνδεση." };
  return cancelAction(actionId, eff);
}

export type ConversationRow = { id: string; title: string | null; lastMessageAt: string };

export async function listMyConversations(): Promise<ConversationRow[]> {
  const eff = await requireEff();
  const rows = await db.aiConversation.findMany({ where: { userId: eff.user.id }, orderBy: { lastMessageAt: "desc" }, take: 30, select: { id: true, title: true, lastMessageAt: true } });
  return rows.map((r) => ({ id: r.id, title: r.title, lastMessageAt: r.lastMessageAt.toISOString() }));
}

export type StoredMessage = { id: string; role: string; content: string; createdAt: string };

export async function getConversationMessages(conversationId: string): Promise<StoredMessage[]> {
  const eff = await requireEff();
  const conv = await db.aiConversation.findUnique({ where: { id: conversationId }, select: { userId: true } });
  if (!conv || conv.userId !== eff.user.id) return [];
  const rows = await db.aiMessage.findMany({ where: { conversationId }, orderBy: { createdAt: "asc" }, select: { id: true, role: true, content: true, createdAt: true } });
  return rows.map((r) => ({ id: r.id, role: r.role, content: r.content, createdAt: r.createdAt.toISOString() }));
}

export async function deleteConversation(conversationId: string): Promise<{ ok: boolean }> {
  const eff = await requireEff();
  const r = await db.aiConversation.deleteMany({ where: { id: conversationId, userId: eff.user.id } });
  return { ok: r.count === 1 };
}

export async function reindexWiki(): Promise<IndexResult> {
  const eff = await requireEff();
  if (eff.real.role !== "SUPER_ADMIN") throw new Error("Forbidden");
  const { indexWiki } = await import("@/lib/ai/assistant/indexer");
  return indexWiki();
}

export type AiActionRow = {
  id: string; createdAt: string; executedAt: string | null; userName: string; userEmail: string; actorId: string | null;
  toolName: string; status: string; buildingId: string | null; error: string | null; summaryLines: string[]; result: unknown;
};

export async function listAiActions(limit = 100): Promise<AiActionRow[]> {
  const eff = await requireEff();
  if (eff.real.role !== "SUPER_ADMIN") throw new Error("Forbidden");
  const rows = await db.aiActionLog.findMany({ orderBy: { createdAt: "desc" }, take: limit, include: { user: { select: { name: true, email: true } } } });
  return rows.map((r) => ({
    id: r.id, createdAt: r.createdAt.toISOString(), executedAt: r.executedAt?.toISOString() ?? null, userName: r.user.name ?? "", userEmail: r.user.email, actorId: r.actorId,
    toolName: r.toolName, status: r.status, buildingId: r.buildingId, error: r.error,
    summaryLines: ((r.previewJson as { summaryLines?: string[] } | null)?.summaryLines) ?? [], result: r.resultJson,
  }));
}
