import { describe, it, expect } from "vitest";
import { parseJsonLoose } from "./extract";

describe("parseJsonLoose", () => {
  it("parses clean JSON", () => { expect(parseJsonLoose('{"a":1}')).toEqual({ a: 1 }); });
  it("strips markdown code fences", () => { expect(parseJsonLoose('```json\n{"a":1}\n```')).toEqual({ a: 1 }); });
  it("extracts the first object from surrounding prose", () => { expect(parseJsonLoose('Here: {"a":1} done')).toEqual({ a: 1 }); });
  it("throws on empty input", () => { expect(() => parseJsonLoose("")).toThrow(); });
});
