import { describe, it, expect } from "vitest";
import { parseAgentSse, type SseState } from "./sse";

const fresh = (): SseState => ({ buffer: "" });

describe("parseAgentSse", () => {
  it("parses a token event", () => {
    const { events } = parseAgentSse('event: token\ndata: {"delta":"Γεια"}\n\n', fresh());
    expect(events).toEqual([{ type: "token", delta: "Γεια" }]);
  });

  it("parses a tool event with id + name + argsDelta", () => {
    const { events } = parseAgentSse('event: tool\ndata: {"id":"c1","name":"t","argsDelta":"{\\"a\\":"}\n\n', fresh());
    expect(events).toEqual([{ type: "tool", id: "c1", name: "t", argsDelta: '{"a":' }]);
  });

  it("buffers a partial line across chunks", () => {
    const s1 = parseAgentSse('event: token\ndata: {"delta":"a"', fresh());
    expect(s1.events).toEqual([]);
    const s2 = parseAgentSse('}\n\n', s1.state);
    expect(s2.events).toEqual([{ type: "token", delta: "a" }]);
  });

  it("emits done and tolerates blank/malformed lines", () => {
    const { events } = parseAgentSse('event: done\ndata: {}\n\n: comment\n\n', fresh());
    expect(events).toEqual([{ type: "done" }]);
  });

  it("emits error events", () => {
    const { events } = parseAgentSse('event: error\ndata: {"message":"boom"}\n\n', fresh());
    expect(events).toEqual([{ type: "error", message: "boom" }]);
  });
});
