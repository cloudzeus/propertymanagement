export type GeneratedSeo = { title: string; description: string; keywords: string };

function firstJsonObject(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

export function normalizeSeo(raw: unknown): GeneratedSeo {
  const obj = typeof raw === "string" ? firstJsonObject(raw) : raw;
  if (!obj || typeof obj !== "object") return { title: "", description: "", keywords: "" };
  const o = obj as Record<string, unknown>;
  const title = String(o.title ?? "").trim().slice(0, 60);
  const description = String(o.description ?? "").trim().slice(0, 155);
  const kw = o.keywords;
  const keywords = Array.isArray(kw)
    ? kw.map((k) => String(k).trim()).filter(Boolean).join(", ")
    : String(kw ?? "").trim();
  return { title, description, keywords };
}

export function buildSeoPrompt(context: string, brief: string, locale: "el" | "en", siteName: string): string {
  const lang = locale === "el" ? "Greek" : "English";
  return [
    `You are an SEO specialist for "${siteName}", a property-management SaaS operating in Greece (Athens).`,
    `Write SEO metadata in ${lang} for the page described by the CONTEXT below.`,
    `Return ONLY a JSON object: {"title","description","keywords"}.`,
    `Rules: title ≤ 60 characters, description 120–155 characters, keywords = 6-10 comma-separated terms`,
    `mixing the service with local intent (e.g. city/area, "διαχείριση πολυκατοικίας"). Make it unique and click-worthy.`,
    brief.trim() ? `Extra guidance from the editor: ${brief.trim()}` : ``,
    ``,
    `CONTEXT:\n${context}`,
  ].filter(Boolean).join("\n");
}
