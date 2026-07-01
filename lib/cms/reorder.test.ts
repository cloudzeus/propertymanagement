import { describe, it, expect } from "vitest";
import { applyReorder } from "./reorder";

describe("applyReorder", () => {
  const rows = [
    { id: "a", order: 0 },
    { id: "b", order: 1 },
    { id: "c", order: 2 },
  ];

  it("assigns sequential order matching the given id sequence", () => {
    expect(applyReorder(["c", "a", "b"], rows)).toEqual([
      { id: "c", order: 0 },
      { id: "a", order: 1 },
      { id: "b", order: 2 },
    ]);
  });

  it("ignores unknown ids and appends missing rows in original order", () => {
    expect(applyReorder(["b", "zzz"], rows)).toEqual([
      { id: "b", order: 0 },
      { id: "a", order: 1 },
      { id: "c", order: 2 },
    ]);
  });
});
