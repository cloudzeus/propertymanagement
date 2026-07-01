import { describe, it, expect } from "vitest";
import { summarizeContext } from "./seo-context";

describe("summarizeContext", () => {
  it("joins non-empty parts and truncates to max", () => {
    expect(summarizeContext(["a", "", "  b  ", "c"], 100)).toBe("a\nb\nc");
  });
  it("truncates overly long content", () => {
    expect(summarizeContext(["x".repeat(50), "y".repeat(50)], 40).length).toBe(40);
  });
});
