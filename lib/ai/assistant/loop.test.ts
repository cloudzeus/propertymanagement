import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

const m = vi.hoisted(() => ({
  streamChat: vi.fn(), retrieveWiki: vi.fn(async () => []), appendMessage: vi.fn(async () => ({ id: "m-id" })), loadHistory: vi.fn(async () => []),
  maybeSummarize: vi.fn(async () => {}), proposeAction: vi.fn(), expireStale: vi.fn(async () => 0), readRun: vi.fn(async () => ({ ok: true, data: [{ id: "f1" }] })),
}));
vi.mock("@/lib/ai/deepseek", () => ({ streamChat: m.streamChat }));
vi.mock("./retrieval", () => ({ retrieveWiki: m.retrieveWiki }));
vi.mock("./conversations", () => ({ appendMessage: m.appendMessage, loadHistory: m.loadHistory, maybeSummarize: m.maybeSummarize }));
vi.mock("./actions", () => ({ proposeAction: m.proposeAction, expireStale: m.expireStale }));
const readTool = { name: "listFaults", description: "", kind: "read" as const, roles: [], label: "Βλάβες", schema: z.object({}), run: m.readRun };
const writeTool = { name: "createFaultReport", description: "", kind: "write" as const, roles: [], label: "Δήλωση βλάβης", schema: z.object({ title: z.string() }), preview: vi.fn(), execute: vi.fn() };
vi.mock("@/lib/ai/tools/registry", () => ({
  findTool: (n: string) => (n === "listFaults" ? readTool : n === "createFaultReport" ? writeTool : undefined),
  toolsForRole: () => [readTool, writeTool], toAgentTools: (t: { name: string }[]) => t.map((x) => ({ name: x.name, description: "", parameters: {} })),
}));

import { runAssistantTurn } from "./loop";
import { parseAgentSse, type AgentEvent } from "@/lib/ai/sse";
import type { AssistantCtx } from "@/lib/ai/tools/types";
import type { EffectiveSession } from "@/lib/auth-effective";

const ctx: AssistantCtx = {
  user: { id: "u1", name: "Μ", email: "e", role: "PROPERTY_RESIDENT", customerId: "c1", companyId: null }, real: { id: "u1", role: "PROPERTY_RESIDENT" }, impersonating: false,
  surface: "customer", perms: new Set(), scope: { seesAllCustomers: false, managerBuildingIds: [], occupantUnits: [], supplierId: null }, page: { path: "/portal" }, now: new Date(),
};
const eff: EffectiveSession = { user: { id: "u1", role: "PROPERTY_RESIDENT", roleId: null, companyId: null, customerId: "c1", name: "Μ", email: "e" }, real: { id: "u1", role: "PROPERTY_RESIDENT" }, impersonatorId: null };

async function collect(stream: ReadableStream<Uint8Array>): Promise<AgentEvent[]> {
  const reader = stream.getReader(); const dec = new TextDecoder(); let state = { buffer: "" }; const out: AgentEvent[] = [];
  for (;;) { const { done, value } = await reader.read(); if (done) break; const r = parseAgentSse(dec.decode(value, { stream: true }), state); state = r.state; out.push(...r.events); }
  return out;
}
const reply = (content: string, toolCalls: { id: string; name: string; args: string }[] = []) => async (o: { onToken?: (t: string) => void }) => { for (const ch of content.split("")) o.onToken?.(ch); return { content, toolCalls, usage: 10 }; };

beforeEach(() => { vi.clearAllMocks(); m.loadHistory.mockResolvedValue([]); m.retrieveWiki.mockResolvedValue([]); });

describe("runAssistantTurn", () => {
  it("streams tokens, persists the assistant message and ends with meta + done", async () => {
    m.streamChat.mockImplementationOnce(reply("Γεια"));
    const ev = await collect(runAssistantTurn({ eff, ctx, conversationId: "c1", userText: "γεια" }));
    expect(ev.filter((e) => e.type === "token").map((e) => (e as { delta: string }).delta).join("")).toBe("Γεια");
    expect(ev.at(-2)).toEqual({ type: "meta", conversationId: "c1", messageId: "m-id" });
    expect(ev.at(-1)).toEqual({ type: "done" });
    expect(m.appendMessage).toHaveBeenCalledWith("c1", { role: "user", content: "γεια" });
    expect(m.appendMessage).toHaveBeenLastCalledWith("c1", expect.objectContaining({ role: "assistant", content: "Γεια" }));
    expect(m.expireStale).toHaveBeenCalled();
  });
  it("runs a read tool, feeds its result back, then streams the answer", async () => {
    m.streamChat.mockImplementationOnce(reply("", [{ id: "call_1", name: "listFaults", args: "{}" }])).mockImplementationOnce(reply("Μία βλάβη."));
    const ev = await collect(runAssistantTurn({ eff, ctx, conversationId: "c1", userText: "βλάβες;" }));
    expect(ev).toEqual(expect.arrayContaining([{ type: "tool_status", name: "listFaults", label: "Βλάβες", state: "running" }, { type: "tool_status", name: "listFaults", label: "Βλάβες", state: "done" }]));
    expect(m.readRun).toHaveBeenCalledWith({}, ctx);
    const second = m.streamChat.mock.calls[1]![0] as { messages: { role: string; content: string; tool_call_id?: string }[] };
    expect(second.messages.at(-1)).toEqual({ role: "tool", content: JSON.stringify({ ok: true, data: [{ id: "f1" }] }), tool_call_id: "call_1" });
    expect(ev.filter((e) => e.type === "token").length).toBeGreaterThan(0);
  });
  it("proposes a write tool as a confirm card without executing", async () => {
    m.proposeAction.mockResolvedValue({ card: { actionId: "a1", tool: "createFaultReport", title: "Δήλωση βλάβης", summaryLines: ["Τίτλος: Διαρροή"], warnings: [] } });
    m.streamChat.mockImplementationOnce(reply("", [{ id: "call_1", name: "createFaultReport", args: '{"title":"Διαρροή"}' }])).mockImplementationOnce(reply("Επιβεβαιώστε την κάρτα."));
    const ev = await collect(runAssistantTurn({ eff, ctx, conversationId: "c1", userText: "δήλωσε βλάβη" }));
    expect(ev).toContainEqual({ type: "confirm", card: expect.objectContaining({ actionId: "a1" }) });
    expect(m.proposeAction).toHaveBeenCalledWith(ctx, writeTool, { title: "Διαρροή" }, "c1");
    expect(writeTool.execute).not.toHaveBeenCalled();
    const second = m.streamChat.mock.calls[1]![0] as { tools?: unknown[] };
    expect(second.tools ?? []).toHaveLength(0);
    expect(ev.at(-1)).toEqual({ type: "done" });
  });
  it("survives an unknown tool and malformed args, answering the model's error back", async () => {
    m.streamChat.mockImplementationOnce(reply("", [{ id: "c1", name: "nope", args: "{}" }, { id: "c2", name: "listFaults", args: "{bad" }])).mockImplementationOnce(reply("Συγγνώμη."));
    const ev = await collect(runAssistantTurn({ eff, ctx, conversationId: "c1", userText: "x" }));
    const second = m.streamChat.mock.calls[1]![0] as { messages: { role: string; content: string }[] };
    const toolMsgs = second.messages.filter((x) => x.role === "tool").map((x) => x.content);
    expect(toolMsgs[0]).toContain("Άγνωστο εργαλείο");
    expect(toolMsgs[1]).toContain("Μη έγκυρα ορίσματα");
    expect(ev.at(-1)).toEqual({ type: "done" });
  });
  it("emits error then done when the model call fails", async () => {
    m.streamChat.mockRejectedValueOnce(new Error("deepseek_unavailable"));
    const ev = await collect(runAssistantTurn({ eff, ctx, conversationId: "c1", userText: "x" }));
    expect(ev).toEqual([{ type: "error", message: "Ο βοηθός δεν είναι διαθέσιμος αυτή τη στιγμή." }, { type: "done" }]);
  });
});
