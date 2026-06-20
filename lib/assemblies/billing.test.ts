import { describe, it, expect } from "vitest";
import { addSession, totalParticipantMinutes } from "./billing";

describe("participant minutes", () => {
  it("accumulates seconds across join/leave then rounds up to minutes", () => {
    let secs = 0;
    secs = addSession(secs, 0, 90);    // 90s
    secs = addSession(secs, 100, 160); // +60s = 150s
    expect(secs).toBe(150);
    expect(totalParticipantMinutes([150, 30])).toBe(4); // ceil(150/60)+ceil(30/60)=3+1
  });
});
