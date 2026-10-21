import { describe, it, expect } from "vitest";
import { groupActions, pickPrimary, type MenuEntry } from "./action-menu";

const e = (key: string, over: Partial<MenuEntry> = {}): MenuEntry => ({ key, label: key, onPick: () => {}, ...over });
const keys = (groups: MenuEntry[][]) => groups.map((g) => g.map((x) => x.key));

describe("groupActions", () => {
  it("groups by section in first-appearance order, keeping item order", () => {
    const groups = groupActions([e("a", { section: "status" }), e("b", { section: "assign" }), e("c", { section: "status" }), e("d", { section: "navigate" })]);
    expect(keys(groups)).toEqual([["a", "c"], ["b"], ["d"]]);
  });
  it("puts unsectioned entries in their own group where they appear, and never yields empty groups", () => {
    expect(keys(groupActions([e("a"), e("b", { section: "s" }), e("c")]))).toEqual([["a"], ["b"], ["c"]]);
    expect(keys(groupActions([e("a"), e("b")]))).toEqual([["a", "b"]]);
    expect(groupActions([])).toEqual([]);
  });
});

describe("pickPrimary", () => {
  it("three unflagged entries → all pills, no overflow (legacy lists unchanged)", () => {
    const r = pickPrimary([e("a"), e("b"), e("c")]);
    expect(r.pills.map((x) => x.key)).toEqual(["a", "b", "c"]);
    expect(r.overflow).toEqual([]);
  });
  it("five unflagged → first two pills + the whole list as overflow", () => {
    const r = pickPrimary([e("a"), e("b"), e("c"), e("d"), e("f")]);
    expect(r.pills.map((x) => x.key)).toEqual(["a", "b"]);
    expect(r.overflow.map((x) => x.key)).toEqual(["a", "b", "c", "d", "f"]);
  });
  it("twelve entries with three primary → first two primary as pills, overflow all twelve", () => {
    const all = Array.from({ length: 12 }, (_, i) => e(`k${i}`, { primary: [3, 7, 9].includes(i) }));
    const r = pickPrimary(all);
    expect(r.pills.map((x) => x.key)).toEqual(["k3", "k7"]);
    expect(r.overflow).toHaveLength(12);
  });
  it("one primary among four → one pill + overflow", () => {
    const r = pickPrimary([e("a"), e("b", { primary: true }), e("c"), e("d")]);
    expect(r.pills.map((x) => x.key)).toEqual(["b"]);
    expect(r.overflow).toHaveLength(4);
  });
  it("a primary among three still gets the pills + overflow treatment", () => {
    const r = pickPrimary([e("a", { primary: true }), e("b"), e("c")]);
    expect(r.pills.map((x) => x.key)).toEqual(["a"]);
    expect(r.overflow).toHaveLength(3);
  });
});
