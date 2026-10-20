import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({ log: vi.fn(async () => {}), env: { GEMINI_API_KEY: "secret-key" } as { GEMINI_API_KEY?: string } }));
vi.mock("@/lib/env", () => ({ env: m.env }));
vi.mock("@/lib/api-costs", () => ({ logAPIUsage: m.log }));

import { embedTexts } from "./embeddings";

const fetchMock = vi.fn();
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal("fetch", fetchMock); });

describe("embedTexts", () => {
  it("sends the API key in the x-goog-api-key header, never in the URL", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ embeddings: [{ values: [0.1, 0.2] }] }) });
    const out = await embedTexts(["κείμενο"], "RETRIEVAL_DOCUMENT");
    expect(out).toEqual([[0.1, 0.2]]);
    const [url, init] = fetchMock.mock.calls[0]! as [string, { headers: Record<string, string> }];
    expect(url).not.toContain("key=");
    expect(url).not.toContain("secret-key");
    expect(init.headers["x-goog-api-key"]).toBe("secret-key");
  });
  it("returns null without calling the API when no key is configured", async () => {
    m.env.GEMINI_API_KEY = undefined;
    try { expect(await embedTexts(["x"], "RETRIEVAL_QUERY")).toBeNull(); } finally { m.env.GEMINI_API_KEY = "secret-key"; }
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("logs a FAILED usage row and throws on an HTTP error", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 403 });
    await expect(embedTexts(["x"], "RETRIEVAL_QUERY")).rejects.toThrow("403");
    expect(m.log).toHaveBeenCalledWith(expect.objectContaining({ status: "FAILED", errorMessage: "HTTP 403" }));
  });
});
