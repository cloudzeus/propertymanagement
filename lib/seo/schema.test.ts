import { describe, it, expect } from "vitest";
import { organizationSchema, webSiteSchema, faqPageSchema, breadcrumbSchema } from "./schema";
import { articleSchema, personSchema } from "./schema";

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

describe("article/person schema", () => {
  it("article", () => {
    const s: any = articleSchema({ headline: "T", url: "https://x.gr/blog/a", datePublished: "2026-01-01", authorName: "Jo", image: "https://x.gr/i.webp" });
    expect(s["@type"]).toBe("Article");
    expect(s.headline).toBe("T");
    expect(s.author.name).toBe("Jo");
    expect(s.image).toBe("https://x.gr/i.webp");
  });
  it("person", () => {
    expect((personSchema({ name: "Jo" }) as any)["@type"]).toBe("Person");
  });
});
