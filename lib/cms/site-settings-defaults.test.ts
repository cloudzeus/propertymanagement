import { describe, it, expect } from "vitest";
import { DEFAULT_CONSENT_CONFIG } from "./site-settings-defaults";
describe("default consent config", () => {
  it("has essential required + analytics/marketing optional", () => {
    const keys = DEFAULT_CONSENT_CONFIG.categories.map((c) => c.key);
    expect(keys).toEqual(["essential", "analytics", "marketing"]);
    expect(DEFAULT_CONSENT_CONFIG.categories[0].required).toBe(true);
    expect(DEFAULT_CONSENT_CONFIG.categories[1].required).toBe(false);
  });
  it("labels are translatable", () => {
    expect(DEFAULT_CONSENT_CONFIG.title).toHaveProperty("el");
    expect(DEFAULT_CONSENT_CONFIG.title).toHaveProperty("en");
  });
});
