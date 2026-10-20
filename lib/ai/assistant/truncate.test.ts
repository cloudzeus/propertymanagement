import { describe, it, expect } from "vitest";
import { truncateToolResult } from "./truncate";

describe("truncateToolResult", () => {
  it("returns compact JSON when it fits", () => {
    expect(truncateToolResult({ a: 1 }, 100)).toBe('{"a":1}');
  });
  it("cuts arrays to fit and notes how many were dropped, keeping JSON valid", () => {
    const rows = Array.from({ length: 50 }, (_, i) => ({ id: `row-${i}`, text: "x".repeat(40) }));
    const out = truncateToolResult({ rows }, 600);
    expect(out.length).toBeLessThanOrEqual(600);
    const parsed = JSON.parse(out);
    expect(parsed.rows.length).toBeLessThan(50);
    expect(parsed._note).toMatch(/και \d+ ακόμη/);
  });
  it("hard-truncates a long string payload", () => {
    const out = truncateToolResult({ text: "α".repeat(5000) }, 200);
    expect(out.length).toBeLessThanOrEqual(200);
    expect(() => JSON.parse(out)).not.toThrow();
  });
});
