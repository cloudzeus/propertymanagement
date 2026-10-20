import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/env", () => ({ env: { DEEPSEEK_API_KEY: "k" } }));
const logAPIUsage = vi.hoisted(() => vi.fn(async () => null));
vi.mock("@/lib/api-costs", () => ({ logAPIUsage }));

import { streamChat } from "./deepseek";

const sseBody = (chunks: unknown[]) => new ReadableStream<Uint8Array>({
  start(c) {
    const enc = new TextEncoder();
    for (const ch of chunks) c.enqueue(enc.encode(`data: ${JSON.stringify(ch)}\n\n`));
    c.enqueue(enc.encode("data: [DONE]\n\n"));
    c.close();
  },
});
const delta = (d: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({ choices: [{ delta: d }], ...extra });

beforeEach(() => { vi.restoreAllMocks(); logAPIUsage.mockClear(); });

describe("streamChat", () => {
  it("assembles content tokens and tool-call deltas keyed by index", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(sseBody([
      delta({ content: "Γει" }), delta({ content: "α" }),
      delta({ tool_calls: [{ index: 0, id: "call_1", function: { name: "listFaults", arguments: '{"a"' } }] }),
      delta({ tool_calls: [{ index: 0, function: { arguments: ":1}" } }] }),
      { choices: [], usage: { total_tokens: 42 } },
    ]), { status: 200 }));
    const tokens: string[] = [];
    const r = await streamChat({ system: "s", messages: [{ role: "user", content: "x" }], tools: [], userId: "u1", onToken: (t) => tokens.push(t) });
    expect(r.content).toBe("Γεια");
    expect(tokens).toEqual(["Γει", "α"]);
    expect(r.toolCalls).toEqual([{ id: "call_1", name: "listFaults", args: '{"a":1}' }]);
    expect(r.usage).toBe(42);
    expect(logAPIUsage).toHaveBeenCalledWith(expect.objectContaining({ apiName: "deepseek", tokensUsed: 42, status: "SUCCESS", userId: "u1" }));
  });
  it("sends assistant tool_calls and tool messages through to the API body", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(sseBody([delta({ content: "ok" })]), { status: 200 }));
    await streamChat({ system: "s", messages: [
      { role: "assistant", content: "", tool_calls: [{ id: "c1", type: "function", function: { name: "t", arguments: "{}" } }] },
      { role: "tool", content: "{}", tool_call_id: "c1" },
    ] });
    const body = JSON.parse(String(spy.mock.calls[0]![1]!.body));
    expect(body.messages[1]).toMatchObject({ role: "assistant", tool_calls: [{ id: "c1", type: "function" }] });
    expect(body.messages[2]).toEqual({ role: "tool", content: "{}", tool_call_id: "c1" });
  });
  it("throws on HTTP failure and logs it", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("nope", { status: 500 }));
    await expect(streamChat({ system: "s", messages: [] })).rejects.toThrow("DeepSeek error 500");
    expect(logAPIUsage).toHaveBeenCalledWith(expect.objectContaining({ status: "FAILED" }));
  });
});
