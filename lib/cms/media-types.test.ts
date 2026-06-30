import { describe, it, expect } from "vitest";
import { detectMediaType } from "./media-types";
describe("detectMediaType", () => {
  it("svg by mime or extension", () => {
    expect(detectMediaType("image/svg+xml", "x.png")).toBe("SVG");
    expect(detectMediaType("application/octet-stream", "logo.SVG")).toBe("SVG");
  });
  it("image", () => { expect(detectMediaType("image/png", "x.png")).toBe("IMAGE"); });
  it("video", () => { expect(detectMediaType("video/mp4", "x.mp4")).toBe("VIDEO"); });
  it("non-media falls back to OTHER", () => {
    expect(detectMediaType("application/pdf", "x.pdf")).toBe("OTHER");
  });
});
