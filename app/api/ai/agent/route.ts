import { auth } from "@/auth";
import { getAgent } from "@/lib/ai/agents";
import { runAgentStream, type AgentMessage } from "@/lib/ai/agent";
import { getWalletBalance } from "@/lib/wallet/ledger";
import { resolveCustomerId } from "@/lib/wallet/resolve-customer";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  if ((session.user as any).role !== "SUPER_ADMIN") return new Response("Forbidden", { status: 403 });

  let body: { agentKey?: string; messages?: AgentMessage[]; buildingId?: string; customerId?: string };
  try {
    body = await request.json();
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  const agent = body.agentKey ? getAgent(body.agentKey) : null;
  if (!agent) return new Response("Unknown agent", { status: 400 });

  // Pre-flight wallet gate: block user-facing AI when the owning customer's wallet is depleted.
  // Context is optional here (super-admin onboarding builds a not-yet-existing building), so we
  // only gate when a customer can actually be resolved — otherwise skip gracefully.
  const customerId = await resolveCustomerId({ buildingId: body.buildingId, customerId: body.customerId });
  if (customerId && (await getWalletBalance("CUSTOMER", customerId)) <= 0) {
    return new Response(JSON.stringify({ error: "wallet_empty" }), {
      status: 402,
      headers: { "Content-Type": "application/json" },
    });
  }
  const messages = Array.isArray(body.messages) ? body.messages : [];

  const stream = runAgentStream({ system: agent.system, messages, tools: agent.tools });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
