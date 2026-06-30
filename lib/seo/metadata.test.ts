import { describe, it, expect } from "vitest";
import { buildMetadata } from "./metadata";

const seo = { title: "Τιμές", description: "Πλάνα", ogImage: "https://x.gr/og.png" };

describe("buildMetadata", () => {
  const m = buildMetadata({ seo, locale: "el", path: "/pricing", baseUrl: "https://x.gr" });
  it("sets title/description", () => {
    expect(m.title).toBe("Τιμές");
    expect(m.description).toBe("Πλάνα");
  });
  it("sets canonical and hreflang alternates", () => {
    expect(m.alternates?.canonical).toBe("https://x.gr/pricing");
    expect(m.alternates?.languages?.el).toBe("https://x.gr/pricing");
    expect(m.alternates?.languages?.en).toBe("https://x.gr/en/pricing");
    expect((m.alternates?.languages as any)["x-default"]).toBe("https://x.gr/pricing");
  });
  it("sets openGraph image", () => {
    expect((m.openGraph?.images as any)?.[0]?.url ?? m.openGraph?.images).toContain("og.png");
  });
});
