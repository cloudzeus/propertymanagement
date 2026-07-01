import { describe, it, expect } from "vitest";
import { normalizeSeo } from "./seo";

describe("normalizeSeo", () => {
  it("parses JSON and clamps lengths", () => {
    const out = normalizeSeo(
      JSON.stringify({ title: "T".repeat(80), description: "D".repeat(200), keywords: ["a", "b"] }),
    );
    expect(out.title.length).toBe(60);
    expect(out.description.length).toBe(155);
    expect(out.keywords).toBe("a, b");
  });

  it("extracts JSON from surrounding prose and trims", () => {
    const out = normalizeSeo('Here you go:\n{"title":"  Hi  ","description":"d","keywords":"k1, k2"} thanks');
    expect(out).toEqual({ title: "Hi", description: "d", keywords: "k1, k2" });
  });

  it("returns safe empties on garbage", () => {
    expect(normalizeSeo("no json here")).toEqual({ title: "", description: "", keywords: "" });
  });
});
