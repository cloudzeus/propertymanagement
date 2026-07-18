import { describe, it, expect, vi } from "vitest";
import { publishBuildingEvent, subscribeBuilding } from "./bus";

describe("realtime bus", () => {
  it("delivers events to subscribers of the same building only", () => {
    const a = vi.fn(); const b = vi.fn();
    const offA = subscribeBuilding("b1", a);
    const offB = subscribeBuilding("b2", b);
    publishBuildingEvent("b1", "payment");
    expect(a).toHaveBeenCalledWith({ type: "payment" });
    expect(b).not.toHaveBeenCalled();
    offA(); offB();
  });
  it("stops delivery after unsubscribe", () => {
    const fn = vi.fn();
    const off = subscribeBuilding("b1", fn);
    off();
    publishBuildingEvent("b1", "expense");
    expect(fn).not.toHaveBeenCalled();
  });
  it("publish never throws even with a throwing subscriber", () => {
    const off = subscribeBuilding("b1", () => { throw new Error("boom"); });
    expect(() => publishBuildingEvent("b1", "announcement")).not.toThrow();
    off();
  });
});
