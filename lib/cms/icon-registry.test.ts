import { describe, it, expect } from "vitest";
import { resolveIcon, ICON_NAMES } from "./icon-registry";

describe("icon registry", () => {
  it("resolves known icons to a component", () => {
    expect(typeof resolveIcon("RiBuildingLine")).toBe("function");
  });
  it("returns a fallback component (never null) for unknown icon names", () => {
    expect(typeof resolveIcon("RiTotallyFake")).toBe("function");
  });
  it("exposes the allowlist names for the editor dropdown", () => {
    expect(ICON_NAMES).toContain("RiBuildingLine");
    expect(ICON_NAMES.length).toBeGreaterThanOrEqual(8);
  });
});
