export type AgentEvent =
  | { type: "token"; delta: string }
  | { type: "tool"; id: string; name?: string; argsDelta: string }
  | { type: "done" }
  | { type: "error"; message: string };

export type SseState = { buffer: string };

/** Incremental SSE parser for the normalized agent stream. Accumulates a buffer
 *  across chunks; emits one AgentEvent per complete `event:/data:` block. Blank
 *  lines, comments (`:`), and malformed JSON are tolerated (skipped). */
export function parseAgentSse(chunk: string, state: SseState): { events: AgentEvent[]; state: SseState } {
  const buffer = state.buffer + chunk;
  const blocks = buffer.split("\n\n");
  const rest = blocks.pop() ?? ""; // last piece may be incomplete
  const events: AgentEvent[] = [];

  for (const block of blocks) {
    let ev: string | null = null;
    let dataRaw = "";
    for (const line of block.split("\n")) {
      if (line.startsWith(":")) continue;
      if (line.startsWith("event:")) ev = line.slice(6).trim();
      else if (line.startsWith("data:")) dataRaw += line.slice(5).trim();
    }
    if (!ev) continue;
    let data: any = {};
    if (dataRaw) { try { data = JSON.parse(dataRaw); } catch { continue; } }
    if (ev === "token") events.push({ type: "token", delta: String(data.delta ?? "") });
    else if (ev === "tool") events.push({ type: "tool", id: String(data.id ?? ""), name: data.name, argsDelta: String(data.argsDelta ?? "") });
    else if (ev === "done") events.push({ type: "done" });
    else if (ev === "error") events.push({ type: "error", message: String(data.message ?? "error") });
  }
  return { events, state: { buffer: rest } };
}
