import { describe, it, expect } from "vitest";
import { createThrottle } from "./throttle";

describe("createThrottle", () => {
  it("spaces calls by the interval using the injected clock", async () => {
    let t = 0;
    const sleeps: number[] = [];
    const throttle = createThrottle(1000, { now: () => t, sleep: async (ms) => { sleeps.push(ms); t += ms; } });
    expect(await throttle(async () => 1)).toBe(1);
    t += 200;
    expect(await throttle(async () => 2)).toBe(2);
    expect(await throttle(async () => 3)).toBe(3);
    expect(sleeps).toEqual([800, 1000]);
  });
  it("serialises concurrent calls", async () => {
    let t = 0;
    const order: number[] = [];
    const throttle = createThrottle(100, { now: () => t, sleep: async (ms) => { t += ms; } });
    await Promise.all([throttle(async () => { order.push(1); }), throttle(async () => { order.push(2); }), throttle(async () => { order.push(3); })]);
    expect(order).toEqual([1, 2, 3]);
    expect(t).toBe(200);
  });
});
