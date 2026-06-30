import { describe, it, expect } from "vitest";
import { applyOverrides } from "./messages";
describe("applyOverrides", () => {
  it("deep-sets dotted keys over defaults", () => {
    const base = { a: { b: "x" }, c: "y" };
    const out = applyOverrides(base, [{ key: "a.b", value: "X" }, { key: "c", value: "Y" }]);
    expect(out).toEqual({ a: { b: "X" }, c: "Y" });
  });
  it("creates missing paths", () => {
    expect(applyOverrides({}, [{ key: "x.y.z", value: "1" }])).toEqual({ x: { y: { z: "1" } } });
  });
  it("does not mutate base", () => {
    const base = { a: "1" }; applyOverrides(base, [{ key: "a", value: "2" }]); expect(base.a).toBe("1");
  });
});
