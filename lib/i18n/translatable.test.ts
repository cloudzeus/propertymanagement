import { describe, it, expect } from "vitest";
import { pickLocale, makeTranslatable, isTranslatable } from "./translatable";

describe("translatable", () => {
  it("makeTranslatable defaults en to el", () => {
    expect(makeTranslatable("Γεια")).toEqual({ el: "Γεια", en: "Γεια" });
    expect(makeTranslatable("Γεια", "Hi")).toEqual({ el: "Γεια", en: "Hi" });
  });
  it("isTranslatable detects shape", () => {
    expect(isTranslatable({ el: 1, en: 2 })).toBe(true);
    expect(isTranslatable("x")).toBe(false);
    expect(isTranslatable({ el: 1 })).toBe(false);
    expect(isTranslatable(null)).toBe(false);
  });
  it("pickLocale picks the locale", () => {
    expect(pickLocale({ el: "Γεια", en: "Hi" }, "en")).toBe("Hi");
    expect(pickLocale({ el: "Γεια", en: "Hi" }, "el")).toBe("Γεια");
  });
  it("pickLocale falls back to el for empty en", () => {
    expect(pickLocale({ el: "Γεια", en: "" }, "en")).toBe("Γεια");
  });
  it("pickLocale returns non-translatable values as-is (back-compat)", () => {
    expect(pickLocale("plain", "en")).toBe("plain");
    expect(pickLocale({ title: "x" } as any, "en")).toEqual({ title: "x" });
  });
});
