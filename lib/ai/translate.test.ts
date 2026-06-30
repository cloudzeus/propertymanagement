import { describe, it, expect } from "vitest";
import { buildTranslatePrompt } from "./translate";
describe("buildTranslatePrompt", () => {
  it("names source and target languages", () => {
    const { system } = buildTranslatePrompt("el", "en");
    expect(system).toMatch(/Greek/i);
    expect(system).toMatch(/English/i);
  });
  it("instructs to preserve markdown/placeholders and return only the translation", () => {
    const { system } = buildTranslatePrompt("el", "en");
    expect(system).toMatch(/markdown|placeholder/i);
  });
});
