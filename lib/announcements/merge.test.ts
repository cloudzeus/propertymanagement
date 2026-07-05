import { describe, it, expect } from "vitest";
import { applyMergeFields, type MergeContext } from "./merge";

const ctx: MergeContext = { name: "Μαρία", building: "Κτ. Α", property: "Ακίνητο 1", unit: "Α1" };

describe("applyMergeFields", () => {
  it("substitutes all known tokens", () => {
    expect(applyMergeFields("Γεια {{name}} στο {{unit}} ({{building}}/{{property}})", ctx))
      .toBe("Γεια Μαρία στο Α1 (Κτ. Α/Ακίνητο 1)");
  });
  it("replaces every occurrence of a token", () => {
    expect(applyMergeFields("{{name}} {{name}}", ctx)).toBe("Μαρία Μαρία");
  });
  it("renders missing/empty fields as empty string, not the token", () => {
    expect(applyMergeFields("[{{unit}}]", { name: "X" })).toBe("[]");
  });
  it("ignores unknown tokens (leaves them verbatim)", () => {
    expect(applyMergeFields("{{balance}}", ctx)).toBe("{{balance}}");
  });
});
