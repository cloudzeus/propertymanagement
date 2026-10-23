import { describe, it, expect } from "vitest";
import { WIZARD_VIDEOS, videoForWizard } from "./videos";
import { WIZARDS, getWizard } from "./registry";

describe("wizard videos registry", () => {
  it("every entry has https src + poster, a title and a registry videoKey", () => {
    const keys = new Set(WIZARDS.map((w) => w.videoKey));
    for (const [k, v] of Object.entries(WIZARD_VIDEOS)) {
      expect(keys.has(k), `unknown videoKey ${k}`).toBe(true);
      expect(v.src).toMatch(/^https:\/\/.+\.mp4$/);
      expect(v.poster).toMatch(/^https:\/\//);
      expect(v.title.length).toBeGreaterThan(0);
      if (v.seconds !== undefined) expect(v.seconds).toBeGreaterThan(0);
    }
  });
  it("videoForWizard returns null until the video is published", () => {
    const v = videoForWizard("customer-new");
    if (WIZARD_VIDEOS[getWizard("customer-new").videoKey]) expect(v?.src).toBeTruthy();
    else expect(v).toBeNull();
  });
});
