import { describe, it, expect } from "vitest";
import { organizationSchema, webSiteSchema, faqPageSchema, breadcrumbSchema } from "./schema";

describe("schema builders", () => {
  it("organization", () => {
    const s = organizationSchema({ name: "Acme", url: "https://x.gr", logo: "https://x.gr/l.png", sameAs: ["https://fb.com/x"] });
    expect(s["@type"]).toBe("Organization");
    expect(s.name).toBe("Acme");
    expect(s.sameAs).toEqual(["https://fb.com/x"]);
  });
  it("website with search action", () => {
    const s = webSiteSchema({ name: "Acme", url: "https://x.gr" });
    expect(s["@type"]).toBe("WebSite");
    expect(s.potentialAction["@type"]).toBe("SearchAction");
  });
  it("faqPage", () => {
    const s = faqPageSchema([{ question: "Q?", answer: "A" }]);
    expect(s["@type"]).toBe("FAQPage");
    expect(s.mainEntity[0]["@type"]).toBe("Question");
    expect(s.mainEntity[0].acceptedAnswer.text).toBe("A");
  });
  it("breadcrumb", () => {
    const s = breadcrumbSchema([{ name: "Home", url: "https://x.gr" }]);
    expect(s["@type"]).toBe("BreadcrumbList");
    expect(s.itemListElement[0].position).toBe(1);
  });
});
