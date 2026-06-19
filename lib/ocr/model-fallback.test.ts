import { describe, it, expect, vi } from "vitest";
import { buildModelChain, tryModels } from "./model-fallback";

describe("buildModelChain", () => {
  it("puts primary first and dedups fallbacks", () => {
    expect(buildModelChain("a", ["b", "a", "c"])).toEqual(["a", "b", "c"]);
  });
});

describe("tryModels", () => {
  it("returns the first ok value without calling later models", async () => {
    const fn = vi.fn(async (m: string) => ({ ok: true as const, value: m }));
    const out = await tryModels(["a", "b"], fn);
    expect(out).toBe("a");
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it("falls through on error and throws the last error if all fail", async () => {
    const fn = vi.fn(async (m: string) => ({ ok: false as const, error: new Error(`fail ${m}`) }));
    await expect(tryModels(["a", "b"], fn)).rejects.toThrow("fail b");
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
