import { describe, it, expect, vi } from "vitest";

const m = vi.hoisted(() => ({ count: vi.fn(async () => 10), findMany: vi.fn(async () => [{ role: "user", content: "γεια" }, { role: "assistant", content: "Γεια σας" }]), update: vi.fn(async () => ({})), streamChat: vi.fn(async () => ({ content: "Περίληψη.", toolCalls: [], usage: 5 })) }));
vi.mock("@/lib/db", () => ({ db: { aiMessage: { count: m.count, findMany: m.findMany }, aiConversation: { update: m.update, findUnique: vi.fn() } } }));
vi.mock("@/lib/ai/deepseek", () => ({ streamChat: m.streamChat }));

import { maybeSummarize } from "./conversations";

describe("maybeSummarize", () => {
  it("attributes the summary call to the user/customer and stores the summary", async () => {
    await maybeSummarize("conv1", { userId: "u1", customerId: "c1" });
    expect(m.streamChat).toHaveBeenCalledWith(expect.objectContaining({ userId: "u1", customerId: "c1" }));
    expect(m.update).toHaveBeenCalledWith(expect.objectContaining({ data: { summary: "Περίληψη." } }));
  });
  it("does nothing when the message count is not a multiple of 10", async () => {
    m.count.mockResolvedValueOnce(7);
    await maybeSummarize("conv1", { userId: "u1" });
    expect(m.streamChat).toHaveBeenCalledTimes(1);
  });
});
