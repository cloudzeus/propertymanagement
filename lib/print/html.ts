/** Unwrap a stored HTML document (AI minutes, rich-text announcements) into printable body markup.
 *  Drops <script>/<style>/<head>, keeps the body content. Content is staff-authored (same trust as the app UI). */
export function printableHtml(html: string): string {
  let s = html;
  const body = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(s);
  if (body) s = body[1];
  s = s.replace(/<head[\s\S]*?<\/head>/gi, "").replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");
  s = s.replace(/<\/?(html|body)[^>]*>/gi, "").replace(/\son\w+="[^"]*"/gi, "");
  return s.trim();
}

/** Plain text → paragraphs (for announcements typed in the hub form). */
export function textToParagraphs(text: string): string {
  const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return text.split(/\n{2,}/).map((p) => `<p>${esc(p.trim()).replace(/\n/g, "<br/>")}</p>`).join("");
}
