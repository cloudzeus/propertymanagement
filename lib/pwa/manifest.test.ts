import { describe, it, expect } from "vitest";
import { buildManifest, PWA_THEME } from "./manifest";

describe("buildManifest", () => {
  it("defaults to Orithon when companyName is missing or the generic default", () => {
    expect(buildManifest({}).name).toBe("Orithon");
    expect(buildManifest({ companyName: "PropertyPro" }).short_name).toBe("Orithon");
    expect(buildManifest({ companyName: "   " }).name).toBe("Orithon");
  });
  it("uses the company name and caps short_name at 12 chars", () => {
    const m = buildManifest({ companyName: "Διαχείριση Ακινήτων Αθηνών" });
    expect(m.name).toBe("Διαχείριση Ακινήτων Αθηνών");
    expect(m.short_name!.length).toBeLessThanOrEqual(12);
    expect(m.short_name).toBe("Διαχείριση");
  });
  it("starts at /home in standalone Greek portrait with cream colors", () => {
    const m = buildManifest({});
    expect(m).toMatchObject({
      id: "/home", start_url: "/home", scope: "/", display: "standalone", orientation: "portrait",
      lang: "el", dir: "ltr", background_color: PWA_THEME, theme_color: "#F6F4EC",
    });
  });
  it("lists 192/512 any icons and a maskable 512", () => {
    const icons = buildManifest({}).icons!;
    expect(icons.map((i) => [i.src, i.sizes, i.purpose])).toEqual([
      ["/icons/icon-192.png", "192x192", "any"],
      ["/icons/icon-512.png", "512x512", "any"],
      ["/icons/maskable-512.png", "512x512", "maskable"],
    ]);
    expect(icons.every((i) => i.type === "image/png")).toBe(true);
  });
  it("has role-neutral shortcuts: report and home", () => {
    expect(buildManifest({}).shortcuts!.map((s) => [s.name, s.url])).toEqual([
      ["Δήλωση βλάβης", "/report"],
      ["Αρχική", "/home"],
    ]);
  });
});
