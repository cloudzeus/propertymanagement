import { describe, it, expect } from "vitest";
import { roomNameForBuilding, transcriptionSettings } from "./daily";

describe("daily helpers", () => {
  it("derives a stable room name from building id", () => {
    expect(roomNameForBuilding("bldg_123")).toBe("assembly-bldg_123");
  });
  it("defaults transcription to Greek nova-3", () => {
    const s = transcriptionSettings();
    expect(s.language).toBe("el");
    expect(s.model).toBe("nova-3");
  });
});
