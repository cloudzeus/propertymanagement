import { describe, it, expect } from "vitest";
import { RateLimiter } from "./rate-limit";

describe("RateLimiter", () => {
  it("allows up to the limit inside the window, then denies, then allows after the window", () => {
    const rl = new RateLimiter(30, 60_000);
    const t0 = 1_000_000;
    for (let i = 0; i < 30; i++) expect(rl.allow("u1", t0 + i)).toBe(true);
    expect(rl.allow("u1", t0 + 100)).toBe(false);
    expect(rl.allow("u2", t0 + 100)).toBe(true);
    expect(rl.allow("u1", t0 + 60_001)).toBe(true);
  });
});
