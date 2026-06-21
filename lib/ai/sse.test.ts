import { describe, it, expect } from "vitest";
import { parseAgentSse, accumulateTool, type SseState, type ToolAccumulator } from "./sse";

const fresh = (): SseState => ({ buffer: "" });

describe("accumulateTool", () => {
  it("assembles args split across deltas where only the first carries the name (id stable by index)", () => {
    const acc: ToolAccumulator = new Map();
    // first delta: name present, partial args
    expect(accumulateTool(acc, { id: "0", name: "updateBuildingOnboardingData", argsDelta: '{"address":"Ακαδημίας ' })).toBeNull();
    // continuation delta: no name, rest of args — same id (index)
    const done = accumulateTool(acc, { id: "0", argsDelta: '12","totalApartments":8}' });
    expect(done).toEqual({ name: "updateBuildingOnboardingData", args: { address: "Ακαδημίας 12", totalApartments: 8 } });
  });

  it("returns null while a tool name is unknown", () => {
    const acc: ToolAccumulator = new Map();
    expect(accumulateTool(acc, { id: "0", argsDelta: "{}" })).toBeNull();
  });
});

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
