import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({
  embed: vi.fn(), upsert: vi.fn(async () => ({ id: "c1" })), findMany: vi.fn(async () => []), deleteMany: vi.fn(async () => ({ count: 0 })), executeRaw: vi.fn(async () => 1),
}));
vi.mock("@/lib/db", () => ({ db: { wikiChunk: { upsert: m.upsert, findMany: m.findMany, deleteMany: m.deleteMany }, $executeRaw: m.executeRaw } }));
vi.mock("./embeddings", () => ({ embedTexts: m.embed, toVectorLiteral: (v: number[]) => `[${v.join(",")}]` }));
vi.mock("@/lib/help/index", () => ({ loadWikiIndex: vi.fn(async () => [{ slug: "a", title: "Α", route: "/a", surface: "company", roles: [], body: "## Ένα\nΚείμενο." }]) }));
vi.mock("@/lib/help", () => ({ MANUALS: {}, manualsForRole: () => [] }));

import { indexWiki } from "./indexer";

beforeEach(() => { vi.clearAllMocks(); });

describe("indexWiki", () => {
  it("stores chunks without vectors when the embedding provider fails (keyword-only mode)", async () => {
    m.embed.mockRejectedValue(new Error("Gemini embeddings error 403"));
    const r = await indexWiki();
    expect(r.keywordOnly).toBe(true);
    expect(r.chunks).toBe(1);
    expect(m.upsert).toHaveBeenCalledTimes(1);
    expect(m.executeRaw).not.toHaveBeenCalled();
  });
  it("writes vectors when embeddings succeed", async () => {
    m.embed.mockResolvedValue([[0.1, 0.2]]);
    const r = await indexWiki();
    expect(r).toMatchObject({ keywordOnly: false, embedded: 1 });
    expect(m.executeRaw).toHaveBeenCalledTimes(1);
  });
});
