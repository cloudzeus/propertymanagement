import { describe, it, expect } from "vitest";
import { buildMinutesPrompt } from "./minutes";

describe("buildMinutesPrompt", () => {
  it("includes the transcript and asks for Greek HTML minutes", () => {
    const p = buildMinutesPrompt("Συμμετέχοντες: ...", "Πολυκατοικία Α");
    expect(p).toContain("Συμμετέχοντες: ...");
    expect(p).toContain("Πολυκατοικία Α");
    expect(p.toLowerCase()).toContain("html");
  });
});
