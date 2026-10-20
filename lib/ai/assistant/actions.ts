import { db } from "@/lib/db";
import type { EffectiveSession } from "@/lib/auth-effective";
import type { AssistantCtx, ExecuteResult, WriteTool } from "@/lib/ai/tools/types";
import { findTool, toolsForRole } from "@/lib/ai/tools/registry";
import { buildAssistantContext } from "./context";
import { canConfirm, zodErrorMessage, PROPOSAL_TTL_MS, type ConfirmCard } from "./actions-core";
import type { PageContext } from "./page-context";

/** How long an EXECUTING claim may live before it is considered crashed. */
export const EXECUTING_TIMEOUT_MS = 5 * 60 * 1000;

/** The page ids the proposal was previewed with (already authorized once; re-authorized on confirm). */
function pageOf(ctx: AssistantCtx): PageContext {
  const page: PageContext = { path: ctx.page.path };
  if (ctx.page.buildingId) page.buildingId = ctx.page.buildingId;
  if (ctx.page.requestId) page.requestId = ctx.page.requestId;
  if (ctx.page.tab) page.tab = ctx.page.tab;
  return page;
}

/** Validate + preview a write tool call and persist it as a PROPOSED action (nothing is executed). */
export async function proposeAction(ctx: AssistantCtx, tool: WriteTool<unknown>, rawArgs: unknown, conversationId: string): Promise<{ card: ConfirmCard } | { error: string }> {
  const parsed = tool.schema.safeParse(rawArgs);
  if (!parsed.success) return { error: zodErrorMessage(parsed.error.issues) };
  if (!toolsForRole(ctx.user.role, ctx.perms).some((t) => t.name === tool.name)) return { error: "Δεν έχετε δικαίωμα για αυτή την ενέργεια." };
  const preview = await tool.preview(parsed.data, ctx);
  if ("error" in preview) return { error: preview.error };
  const row = await db.aiActionLog.create({
    data: {
      conversationId, userId: ctx.user.id, actorId: ctx.impersonating ? ctx.real.id : null, toolName: tool.name,
      argsJson: parsed.data as object, previewJson: { ...preview, page: pageOf(ctx) } as object, status: "PROPOSED", buildingId: preview.buildingId,
      expiresAt: new Date(ctx.now.getTime() + PROPOSAL_TTL_MS),
    },
    select: { id: true },
  });
  return { card: { actionId: row.id, tool: tool.name, title: preview.title, summaryLines: preview.summaryLines, warnings: preview.warnings } };
}

/** The ONLY path that executes a proposed action: same user, still PROPOSED, not expired, re-validated, run once. */
export async function confirmAction(actionId: string, eff: EffectiveSession): Promise<ExecuteResult> {
  const log = await db.aiActionLog.findUnique({ where: { id: actionId } });
  if (!log) return { ok: false, error: "Η πρόταση δεν βρέθηκε." };
  // A second click on an already executed card gets the first result, not an error.
  if (log.status === "EXECUTED" && log.userId === eff.user.id && log.resultJson) return log.resultJson as ExecuteResult;
  const gate = canConfirm(log, eff.user.id, new Date());
  if (!gate.ok) return { ok: false, error: gate.message };
  const tool = findTool(log.toolName);
  if (!tool || tool.kind !== "write") return { ok: false, error: "Άγνωστη ενέργεια." };

  const claimed = await db.aiActionLog.updateMany({ where: { id: actionId, status: "PROPOSED" }, data: { status: "EXECUTING" } });
  if (claimed.count !== 1) return { ok: false, error: "Η ενέργεια εκτελείται ήδη." };

  const fail = async (error: string): Promise<ExecuteResult> => {
    await db.aiActionLog.update({ where: { id: actionId }, data: { status: "FAILED", error, executedAt: new Date(), actorId: eff.impersonatorId ?? log.actorId ?? null } });
    await note(log.conversationId, tool.name, `✖ ${error}`);
    return { ok: false, error };
  };

  try {
    // Re-authorize with the page the proposal was previewed on (the conversation's pagePath moves with later messages).
    const savedPage = (log.previewJson as { page?: PageContext } | null)?.page;
    const conv = !savedPage && log.conversationId ? await db.aiConversation.findUnique({ where: { id: log.conversationId }, select: { pagePath: true } }) : null;
    const ctx = await buildAssistantContext(eff, savedPage ?? { path: conv?.pagePath ?? "/" });

    const parsed = tool.schema.safeParse(log.argsJson);
    if (!parsed.success) return await fail(zodErrorMessage(parsed.error.issues));
    if (!toolsForRole(ctx.user.role, ctx.perms).some((t) => t.name === tool.name)) return await fail("Δεν έχετε δικαίωμα για αυτή την ενέργεια.");
    const preview = await tool.preview(parsed.data, ctx);
    if ("error" in preview) return await fail(preview.error);

    let result: ExecuteResult;
    try { result = await tool.execute(preview.resolved, ctx); } catch (e) { result = { ok: false, error: e instanceof Error ? e.message : "Άγνωστο σφάλμα" }; }
    if (!result.ok) return await fail(result.error);

    await db.aiActionLog.update({ where: { id: actionId }, data: { status: "EXECUTED", resultJson: result as object, executedAt: new Date(), actorId: eff.impersonatorId ?? log.actorId ?? null } });
    await note(log.conversationId, tool.name, `✔ ${result.message}${result.href ? ` [${result.href}]` : ""}`);
    return result;
  } catch (e) {
    // Anything that throws after the claim must not strand the row in EXECUTING.
    return fail(e instanceof Error ? e.message : "Άγνωστο σφάλμα");
  }
}

export async function cancelAction(actionId: string, eff: EffectiveSession): Promise<{ ok: boolean; error?: string }> {
  const log = await db.aiActionLog.findUnique({ where: { id: actionId } });
  if (!log) return { ok: false, error: "Η πρόταση δεν βρέθηκε." };
  const gate = canConfirm(log, eff.user.id, new Date());
  if (!gate.ok) return { ok: false, error: gate.message };
  const r = await db.aiActionLog.updateMany({ where: { id: actionId, status: "PROPOSED" }, data: { status: "CANCELLED" } });
  if (r.count === 1) await note(log.conversationId, log.toolName, "Ο χρήστης ακύρωσε την ενέργεια.");
  return { ok: r.count === 1 };
}

/** Mark stale proposals EXPIRED and crashed EXECUTING claims FAILED (called at the start of every assistant turn). */
export async function expireStale(): Promise<number> {
  const now = new Date();
  const expired = await db.aiActionLog.updateMany({ where: { status: "PROPOSED", expiresAt: { lt: now } }, data: { status: "EXPIRED" } });
  const stuck = await db.aiActionLog.updateMany({
    where: { status: "EXECUTING", updatedAt: { lt: new Date(now.getTime() - EXECUTING_TIMEOUT_MS) } },
    data: { status: "FAILED", error: "Η εκτέλεση διακόπηκε (timeout)." },
  });
  return expired.count + stuck.count;
}

async function note(conversationId: string | null, toolName: string, content: string) {
  if (!conversationId) return;
  await db.aiMessage.create({ data: { conversationId, role: "tool", toolName, content } });
  await db.aiConversation.update({ where: { id: conversationId }, data: { lastMessageAt: new Date() } });
}
