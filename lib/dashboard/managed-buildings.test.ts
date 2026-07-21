import { describe, it, expect } from "vitest";
import { classifyObligation } from "./managed-buildings";

const now = new Date("2026-07-21T00:00:00Z");

describe("classifyObligation", () => {
  it("flags a past due date as overdue", () => {
    expect(classifyObligation("2026-07-10T00:00:00Z", 7, now)).toBe("overdue");
  });
  it("flags within-reminder-window as due-soon", () => {
    expect(classifyObligation("2026-07-25T00:00:00Z", 7, now)).toBe("due-soon");
  });
  it("flags far future as scheduled", () => {
    expect(classifyObligation("2026-09-01T00:00:00Z", 7, now)).toBe("scheduled");
  });
  it("treats a null due date as none", () => {
    expect(classifyObligation(null, 7, now)).toBe("none");
  });
});
