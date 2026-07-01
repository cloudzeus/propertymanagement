export type Topic = { title: string; angle: string; tags: string[] };

function firstJsonArray(text: string): unknown {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(text.slice(start, end + 1)); } catch { return null; }
}
function firstJsonObject(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(text.slice(start, end + 1)); } catch { return null; }
}

export function normalizeTopics(raw: unknown): Topic[] {
  const arr = typeof raw === "string" ? firstJsonArray(raw) : raw;
  if (!Array.isArray(arr)) return [];
  const out: Topic[] = [];
  for (const r of arr) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const title = String(o.title ?? "").trim();
    if (!title) continue;
    const angle = String(o.angle ?? "").trim();
    const tags = Array.isArray(o.tags) ? o.tags.map((t) => String(t).trim()).filter(Boolean) : [];
    out.push({ title, angle, tags });
  }
  return out;
}

export function normalizeDraft(raw: unknown): { excerpt: string; body: string } {
  const obj = typeof raw === "string" ? firstJsonObject(raw) : raw;
  if (obj && typeof obj === "object") {
    const o = obj as Record<string, unknown>;
    if ("body" in o || "excerpt" in o) {
      return { excerpt: String(o.excerpt ?? "").trim(), body: String(o.body ?? "").trim() };
    }
  }
  return { excerpt: "", body: typeof raw === "string" ? raw.trim() : "" };
}

export function buildTopicsPrompt(theme: string, existingTitles: string[], count: number): string {
  return [
    `You suggest blog article ideas for a Greek property-management SaaS (κοινόχρηστα, διαχείριση πολυκατοικίας, ακίνητα, νομοθεσία, Αθήνα).`,
    `Propose ${count} fresh, SEO-friendly, non-duplicate ideas in Greek.`,
    `Return ONLY a JSON array: [{"title","angle","tags"}] — angle = 1 sentence, tags = 2-4 short keywords.`,
    theme.trim() ? `Focus theme: ${theme.trim()}` : ``,
    existingTitles.length ? `Avoid duplicating these existing titles:\n- ${existingTitles.slice(0, 40).join("\n- ")}` : ``,
  ].filter(Boolean).join("\n");
}

export function buildDraftPrompt(title: string, angle: string, locale: "el" | "en"): string {
  const lang = locale === "el" ? "Greek" : "English";
  return [
    `Write a complete, original blog article in ${lang} for a property-management SaaS.`,
    `Title: ${title}`,
    angle.trim() ? `Angle: ${angle.trim()}` : ``,
    `Return ONLY a JSON object {"excerpt","body"}: excerpt = 1-2 sentences; body = Markdown, 600-900 words,`,
    `with ## H2 sections, practical and scannable. No front-matter, no title heading duplication.`,
  ].filter(Boolean).join("\n");
}
