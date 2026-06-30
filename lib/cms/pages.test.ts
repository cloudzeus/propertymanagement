import { describe, it, expect } from "vitest";
import { localizedCmsPage } from "./pages";
describe("localizedCmsPage", () => {
  it("picks i18n per locale with legacy fallback", () => {
    const row: any = { title: "L", content: "LC", i18n: { title: { el: "Τ", en: "T" }, body: { el: "Σ", en: "B" } } };
    expect(localizedCmsPage(row, "en")).toEqual({ title: "T", body: "B" });
    expect(localizedCmsPage(row, "el")).toEqual({ title: "Τ", body: "Σ" });
  });
  it("falls back to legacy columns when i18n missing", () => {
    const row: any = { title: "L", content: "LC", i18n: null };
    expect(localizedCmsPage(row, "en")).toEqual({ title: "L", body: "LC" });
  });
});
