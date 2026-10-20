/** Pure helpers that turn an article's `sections` frontmatter (tab key → heading) into a scroll anchor. */

/** Stable, URL-safe id for a heading: lowercase, letters/digits only, hyphen-joined. Mirrors the ids the Markdown renderer gives headings. */
export function headingId(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "");
}

const headingsOf = (markdown: string): string[] => [...markdown.matchAll(/^#{2,4}\s+(.+?)\s*$/gm)].map((m) => m[1]);

/** The heading id for a page tab (`?s=`), when the article maps that tab in `sections: ["key: Heading", …]` and the heading is present in the (role-filtered) markdown. */
export function anchorForTab(markdown: string, sections: string[], tab: string): string | null {
  if (!tab) return null;
  for (const entry of sections) {
    const i = entry.indexOf(":");
    if (i <= 0 || entry.slice(0, i).trim() !== tab) continue;
    const id = headingId(entry.slice(i + 1));
    if (headingsOf(markdown).some((h) => headingId(h) === id)) return id;
  }
  return null;
}
