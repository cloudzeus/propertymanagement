import { describe, it, expect } from "vitest";
import { renderEmail, textToHtml, absoluteUrl, escapeHtml, DEFAULT_EMAIL_BRAND } from "./email-template";

describe("email template", () => {
  it("always carries the logo, title and footer", () => {
    const html = renderEmail({ title: "Δοκιμή <b>", bodyHtml: "<p>x</p>" });
    expect(html).toContain(DEFAULT_EMAIL_BRAND.logoUrl);
    expect(html).toContain("Δοκιμή &lt;b&gt;");
    expect(html).toContain("Πολιτική απορρήτου");
    expect(html).not.toContain("Διαγραφή από τη λίστα");
  });
  it("adds CTA + unsubscribe when given", () => {
    const html = renderEmail({ title: "t", bodyHtml: "", cta: { label: "Άνοιγμα", href: "https://x.y/z" }, unsubscribeUrl: "https://x.y/u" });
    expect(html).toContain('href="https://x.y/z"');
    expect(html).toContain("Διαγραφή από τη λίστα");
  });
  it("escapes text bodies and keeps paragraphs", () => {
    const html = textToHtml("a <b>\n\nc");
    expect(html).toContain("a &lt;b&gt;");
    expect((html.match(/<p /g) ?? []).length).toBe(2);
  });
  it("builds absolute app links", () => {
    expect(absoluteUrl("/admin/x", { siteUrl: "https://s.gr/" })).toBe("https://s.gr/admin/x");
    expect(absoluteUrl("https://a.b/c")).toBe("https://a.b/c");
    expect(escapeHtml("'")).toBe("&#39;");
  });
});
