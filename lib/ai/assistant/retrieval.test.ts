import { describe, it, expect, vi, beforeEach } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
const m = vi.hoisted(() => ({ embed: vi.fn(), queryRaw: vi.fn(), findMany: vi.fn(async (_q: any) => [] as unknown[]) }));
vi.mock("./embeddings", () => ({ embedTexts: m.embed, toVectorLiteral: (v: number[]) => `[${v.join(",")}]` }));
vi.mock("@/lib/db", () => ({ db: { $queryRaw: m.queryRaw, wikiChunk: { findMany: m.findMany } } }));

import { retrieveWiki } from "./retrieval";

beforeEach(() => { vi.clearAllMocks(); });

describe("retrieveWiki", () => {
  it("falls back to keyword search when embeddings are unavailable", async () => {
    m.embed.mockResolvedValue(null);
    m.findMany.mockResolvedValue([{ slug: "s", title: "T", heading: "H", route: "/r", content: "c" }]);
    const hits = await retrieveWiki("πώς πληρώνω τα κοινόχρηστα", "PROPERTY_OWNER", 5);
    expect(m.queryRaw).not.toHaveBeenCalled();
    const arg = m.findMany.mock.calls[0]![0] as { where: { AND: unknown[]; OR: unknown[] }; take: number };
    expect(arg.take).toBe(5);
    expect(arg.where.AND).toEqual([{ content: { contains: "πώς", mode: "insensitive" } }, { content: { contains: "πληρώνω", mode: "insensitive" } }, { content: { contains: "κοινόχρηστα", mode: "insensitive" } }]);
    expect(arg.where.OR).toEqual([{ roles: { isEmpty: true } }, { roles: { has: "PROPERTY_OWNER" } }]);
    expect(hits).toEqual([{ slug: "s", title: "T", heading: "H", route: "/r", content: "c" }]);
  });
  it("uses vector search when an embedding is returned", async () => {
    m.embed.mockResolvedValue([[0.1, 0.2]]);
    m.queryRaw.mockResolvedValue([{ slug: "s", title: "T", heading: null, route: "/r", content: "c", score: 0.9 }]);
    const hits = await retrieveWiki("ερώτηση", "ADMIN", 3);
    expect(m.embed).toHaveBeenCalledWith(["ερώτηση"], "RETRIEVAL_QUERY", expect.anything());
    expect(m.queryRaw).toHaveBeenCalled();
    expect(m.findMany).not.toHaveBeenCalled();
    expect(hits[0]).toMatchObject({ slug: "s", score: 0.9 });
  });
  it("falls back to keyword search when the vector query throws", async () => {
    m.embed.mockResolvedValue([[0.1]]);
    m.queryRaw.mockRejectedValue(new Error('type "vector" does not exist'));
    m.findMany.mockResolvedValue([]);
    expect(await retrieveWiki("ερώτηση δύο", "ADMIN")).toEqual([]);
    expect(m.findMany).toHaveBeenCalled();
  });

  it("remembers an embedding failure for 5 minutes instead of calling Gemini on every turn", async () => {
    vi.resetModules();
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-10-20T10:00:00Z"));
      const { retrieveWiki: rw } = await import("./retrieval");
      m.embed.mockRejectedValue(new Error("Gemini embeddings error 403"));
      m.findMany.mockResolvedValue([]);
      await rw("πρώτη ερώτηση", "ADMIN");
      await rw("δεύτερη ερώτηση", "ADMIN");
      expect(m.embed).toHaveBeenCalledTimes(1);
      vi.setSystemTime(new Date("2026-10-20T10:05:01Z"));
      await rw("τρίτη ερώτηση", "ADMIN");
      expect(m.embed).toHaveBeenCalledTimes(2);
    } finally { vi.useRealTimers(); }
  });
});
