import { describe, it, expect } from "vitest";
import { normalizeTopics, normalizeDraft } from "./articles";

describe("normalizeTopics", () => {
  it("parses array, drops titleless, coerces tags", () => {
    const out = normalizeTopics(
      'x [{"title":" A ","angle":"a","tags":["t1"," t2 "]},{"title":"","angle":"b"}] y',
    );
    expect(out).toEqual([{ title: "A", angle: "a", tags: ["t1", "t2"] }]);
  });
  it("returns [] on garbage", () => {
    expect(normalizeTopics("nope")).toEqual([]);
  });
});

describe("normalizeDraft", () => {
  it("parses {excerpt, body}", () => {
    expect(normalizeDraft('{"excerpt":" e ","body":" b "}')).toEqual({ excerpt: "e", body: "b" });
  });
  it("falls back to body-only on non-JSON", () => {
    expect(normalizeDraft("# Title\n\ntext")).toEqual({ excerpt: "", body: "# Title\n\ntext" });
  });
});
