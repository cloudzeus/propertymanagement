import { getEffectiveSession } from "@/lib/auth-effective";
import { getWalletBalance } from "@/lib/wallet/ledger";
import { CUSTOMER_ROLES } from "@/lib/roles-constants";
import { RateLimiter } from "@/lib/ai/assistant/rate-limit";
import { parsePageContext } from "@/lib/ai/assistant/page-context";
import { buildAssistantContext } from "@/lib/ai/assistant/context";
import { getOrCreateConversation } from "@/lib/ai/assistant/conversations";
import { runAssistantTurn } from "@/lib/ai/assistant/loop";

export const MAX_MESSAGE_CHARS = 4000;
const limiter = new RateLimiter(30, 60_000);

/** POST { conversationId?, message, page: { path, search? } } → SSE (token | tool_status | confirm | meta | error | done). */
export async function POST(request: Request) {
  const eff = await getEffectiveSession();
  if (!eff) return new Response("Unauthorized", { status: 401 });

  let body: { conversationId?: string; message?: string; page?: { path?: string; search?: string } };
  try { body = await request.json(); } catch { return new Response("Bad JSON", { status: 400 }); }
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message || message.length > MAX_MESSAGE_CHARS) return new Response("Bad message", { status: 400 });
  if (!limiter.allow(eff.user.id)) return new Response("Too many requests", { status: 429 });

  const role = eff.user.role as string;
  if ((CUSTOMER_ROLES as readonly string[]).includes(role) && eff.user.customerId) {
    if ((await getWalletBalance("CUSTOMER", eff.user.customerId)) <= 0) {
      return new Response(JSON.stringify({ error: "wallet_empty" }), { status: 402, headers: { "Content-Type": "application/json" } });
    }
  }

  const page = parsePageContext(typeof body.page?.path === "string" ? body.page.path : "/", typeof body.page?.search === "string" ? body.page.search : "");
  const ctx = await buildAssistantContext(eff, page);
  const conv = await getOrCreateConversation(eff, { conversationId: body.conversationId, surface: ctx.surface, pagePath: page.path });

  return new Response(runAssistantTurn({ eff, ctx, conversationId: conv.id, userText: message, signal: request.signal }), {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
}
