import { describe, it, expect } from "vitest";
import { buildSiteSchemas } from "./site-schema";

const settings: any = { siteName: "Acme", social: { facebook: "https://fb.com/a", instagram: null, linkedin: null, x: null, youtube: null, tiktok: null }, geo: { lat: 1, lng: 2 }, address: { street: "S", city: "Athens", postal: "111", country: "GR" }, telephone: "+30", openingHours: null };

describe("buildSiteSchemas", () => {
  const s = buildSiteSchemas(settings, "https://x.gr", "Acme logo url");
  it("emits Organization with sameAs from non-null social", () => {
    const org = s.find((x: any) => x["@type"] === "Organization") as any;
    expect(org.sameAs).toEqual(["https://fb.com/a"]);
  });
  it("emits LocalBusiness when geo+address present", () => {
    const lb = s.find((x: any) => x["@type"] === "LocalBusiness") as any;
    expect(lb.geo.latitude).toBe(1);
    expect(lb.address.addressLocality).toBe("Athens");
  });
});
