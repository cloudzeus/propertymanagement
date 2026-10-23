import { describe, it, expect } from "vitest";
import { DRAFT_TTL_MS, draftStorageKey, formatDraftAge, parseDraft, serializeDraft } from "./draft";

describe("wizard drafts", () => {
  it("key is namespaced per wizard and ctx", () => {
    expect(draftStorageKey("customer-new", null)).toBe("wizard-draft:customer-new:-");
    expect(draftStorageKey("millesimes-setup", "b1")).toBe("wizard-draft:millesimes-setup:b1");
  });

  it("serialize omits listed keys and records step + time", () => {
    const raw = serializeDraft({ name: "A", loginPassword: "x" }, 2, ["loginPassword"], 1000);
    const parsed = JSON.parse(raw);
    expect(parsed.value).toEqual({ name: "A" });
    expect(parsed.step).toBe(2);
    expect(parsed.savedAt).toBe(1000);
  });

  it("parse returns null for missing, invalid json or expired drafts", () => {
    expect(parseDraft(null, { a: 1 })).toBeNull();
    expect(parseDraft("{", { a: 1 })).toBeNull();
    expect(parseDraft(serializeDraft({ a: 2 }, 0, [], 0), { a: 1 }, DRAFT_TTL_MS + 1)).toBeNull();
    expect(parseDraft(serializeDraft({ a: 2 }, 0, [], 0), { a: 1 }, DRAFT_TTL_MS - 1)?.value).toEqual({ a: 2 });
  });

  it("restore merges over defaults, ignores unknown keys", () => {
    const d = parseDraft(JSON.stringify({ value: { a: 5, zzz: 1 }, savedAt: 10, step: 1 }), { a: 1, b: "x" }, 20)!;
    expect(d.value).toEqual({ a: 5, b: "x" });
    expect(d.step).toBe(1);
    expect(d.savedAt).toBe(10);
  });

  it("rejects a draft whose value is not an object", () => {
    expect(parseDraft(JSON.stringify({ value: "str", savedAt: 10, step: 0 }), { a: 1 }, 20)).toBeNull();
  });

  it("formats age in Greek", () => {
    expect(formatDraftAge(0, 30_000)).toBe("μόλις τώρα");
    expect(formatDraftAge(0, 60_000)).toBe("πριν από 1 λεπτό");
    expect(formatDraftAge(0, 5 * 60_000)).toBe("πριν από 5 λεπτά");
    expect(formatDraftAge(0, 3 * 3600_000)).toBe("πριν από 3 ώρες");
    expect(formatDraftAge(0, 30 * 3600_000)).toBe("χθες");
    expect(formatDraftAge(0, 3 * 86400_000)).toBe("πριν από 3 ημέρες");
  });
});
