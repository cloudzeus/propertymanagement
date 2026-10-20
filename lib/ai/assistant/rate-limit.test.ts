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
  it("evicts keys with no hits inside the window so memory does not grow with every user ever seen", () => {
    const rl = new RateLimiter(5, 1_000);
    rl.allow("u1", 0); rl.allow("u2", 10);
    expect(rl.size).toBe(2);
    rl.allow("u3", 5_000);
    expect(rl.size).toBe(1);
    expect(rl.allow("u1", 5_001)).toBe(true);
  });
});
