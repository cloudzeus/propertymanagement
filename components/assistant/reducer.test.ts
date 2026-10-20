import { describe, it, expect } from "vitest";
import { reduce, initialState, type ChatState } from "./reducer";

const card = { actionId: "a1", tool: "createFaultReport", title: "Δήλωση βλάβης", summaryLines: ["Τίτλος: Διαρροή"], warnings: [] };

describe("assistant reducer", () => {
  it("starts a turn with the user message and an empty streaming assistant message", () => {
    const s = reduce(initialState, { type: "start_turn", userText: "γεια", assistantId: "x1" });
    expect(s.messages.map((m) => [m.role, m.content])).toEqual([["user", "γεια"], ["assistant", ""]]);
    expect(s.streaming).toBe(true);
    expect(s.error).toBeNull();
  });
  it("appends tokens and tracks tool chips running → done", () => {
    let s: ChatState = reduce(initialState, { type: "start_turn", userText: "x", assistantId: "x1" });
    s = reduce(s, { type: "sse", assistantId: "x1", event: { type: "tool_status", name: "listFaults", label: "Βλάβες", state: "running" } });
    s = reduce(s, { type: "sse", assistantId: "x1", event: { type: "token", delta: "Μία " } });
    s = reduce(s, { type: "sse", assistantId: "x1", event: { type: "token", delta: "βλάβη." } });
    s = reduce(s, { type: "sse", assistantId: "x1", event: { type: "tool_status", name: "listFaults", label: "Βλάβες", state: "done" } });
    const a = s.messages[1];
    expect(a.content).toBe("Μία βλάβη.");
    expect(a.tools).toEqual([{ name: "listFaults", label: "Βλάβες", state: "done" }]);
  });
  it("attaches a pending confirm card and resolves it on confirm_result / cancelled", () => {
    let s: ChatState = reduce(initialState, { type: "start_turn", userText: "x", assistantId: "x1" });
    s = reduce(s, { type: "sse", assistantId: "x1", event: { type: "confirm", card } });
    expect(s.messages[1].confirm).toMatchObject({ actionId: "a1", state: "pending" });
    const ok = reduce(s, { type: "confirm_result", actionId: "a1", result: { ok: true, message: "Η βλάβη δηλώθηκε.", href: "/portal/requests/r1" } });
    expect(ok.messages[1].confirm).toMatchObject({ state: "executed", resultMessage: "Η βλάβη δηλώθηκε.", href: "/portal/requests/r1" });
    const failed = reduce(s, { type: "confirm_result", actionId: "a1", result: { ok: false, error: "Η πρόταση έληξε" } });
    expect(failed.messages[1].confirm).toMatchObject({ state: "failed", resultMessage: "Η πρόταση έληξε" });
    expect(reduce(s, { type: "cancelled", actionId: "a1" }).messages[1].confirm?.state).toBe("cancelled");
  });
  it("records meta, stops streaming on done, and sets error on error", () => {
    let s: ChatState = reduce(initialState, { type: "start_turn", userText: "x", assistantId: "x1" });
    s = reduce(s, { type: "sse", assistantId: "x1", event: { type: "meta", conversationId: "c9", messageId: "m1" } });
    expect(s.conversationId).toBe("c9");
    expect(reduce(s, { type: "sse", assistantId: "x1", event: { type: "done" } }).streaming).toBe(false);
    const e = reduce(s, { type: "sse", assistantId: "x1", event: { type: "error", message: "boom" } });
    expect(e.error).toBe("boom");
    expect(e.streaming).toBe(false);
  });
  it("loads a stored conversation and resets", () => {
    const s = reduce(initialState, { type: "load", conversationId: "c1", messages: [{ id: "1", role: "user", content: "a", createdAt: "" }, { id: "2", role: "tool", content: "✔ ok", createdAt: "" }] });
    expect(s.conversationId).toBe("c1");
    expect(s.messages.map((m) => m.role)).toEqual(["user", "tool"]);
    expect(reduce(s, { type: "reset" })).toEqual(initialState);
  });
  it("marks the card failed (not cancelled, not pending) when cancelling fails, and cancelled when it succeeds", () => {
    let s: ChatState = reduce(initialState, { type: "start_turn", userText: "x", assistantId: "x1" });
    s = reduce(s, { type: "sse", assistantId: "x1", event: { type: "confirm", card } });
    const bad = reduce(s, { type: "cancel_result", actionId: "a1", result: { ok: false, error: "Η πρόταση έληξε" } });
    expect(bad.messages[1].confirm).toMatchObject({ state: "failed", resultMessage: "Η πρόταση έληξε" });
    const ok = reduce(s, { type: "cancel_result", actionId: "a1", result: { ok: true } });
    expect(ok.messages[1].confirm?.state).toBe("cancelled");
    const silent = reduce(s, { type: "cancel_result", actionId: "a1", result: { ok: false } });
    expect(silent.messages[1].confirm).toMatchObject({ state: "failed", resultMessage: expect.stringMatching(/ακύρωση/i) });
  });
});
