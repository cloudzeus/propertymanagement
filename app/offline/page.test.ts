import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import OfflinePage from "./page";

/**
 * Η /offline αποθηκεύεται στο install του SW και μπορεί να ζήσει πολλά deploys:
 * τα hashed chunks (CSS tokens, React) που αναφέρει μπορεί να μην υπάρχουν πια.
 * Άρα πρέπει να δουλεύει ΧΩΡΙΣ JS και ΧΩΡΙΣ το globals.css.
 */
describe("/offline page is self-sufficient", () => {
  const html = renderToStaticMarkup(createElement(OfflinePage));
  it("retries with a plain link to the current URL, not a JS button", () => {
    expect(html).not.toContain("<button");
    expect(html).toMatch(/<a[^>]*href=""[^>]*>Δοκιμή ξανά<\/a>/);
  });
  it("gives every CSS variable a literal fallback", () => {
    const bare = html.match(/var\(--[\w-]+\)/g) ?? [];
    expect(bare, `tokens without fallback: ${bare.join(", ")}`).toEqual([]);
  });
  it("links home with a plain anchor", () => {
    expect(html).toMatch(/<a[^>]*href="\/home"[^>]*>Αρχική<\/a>/);
  });
});
