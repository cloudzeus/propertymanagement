import { auth } from "@/auth";
import { getAgent } from "@/lib/ai/agents";
import { runAgentStream, type AgentMessage } from "@/lib/ai/agent";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== "SUPER_ADMIN") {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: { agentKey?: string; messages?: AgentMessage[] };
  try {
    body = await request.json();
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  const agent = body.agentKey ? getAgent(body.agentKey) : null;
  if (!agent) return new Response("Unknown agent", { status: 400 });
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
