export type FeatureItem = { icon: string; title: string; body: string };

/** Validate/clean raw model output into safe FeatureItems. */
export function normalizeFeatureItems(
  raw: unknown,
  iconNames: string[],
  fallbackIcon: string,
): FeatureItem[] {
  if (!Array.isArray(raw)) return [];
  const allow = new Set(iconNames);
  const out: FeatureItem[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const title = String((r as Record<string, unknown>).title ?? "").trim();
    if (!title) continue;
    const body = String((r as Record<string, unknown>).body ?? "").trim();
    const iconRaw = String((r as Record<string, unknown>).icon ?? "").trim();
    out.push({ icon: allow.has(iconRaw) ? iconRaw : fallbackIcon, title, body });
  }
  return out;
}

/** Build the DeepSeek prompt for feature generation. */
export function buildFeaturePrompt(
  brief: string,
  count: number,
  locale: "el" | "en",
  iconNames: string[],
): string {
  const lang = locale === "el" ? "Greek" : "English";
  return [
    `You write website "feature" cards for a property-management SaaS.`,
    `From the brief, produce exactly ${count} features in ${lang}.`,
    `Return ONLY a JSON array of objects: {"icon","title","body"}.`,
    `"icon" MUST be one of: ${iconNames.join(", ")}.`,
    `"title": max 6 words. "body": 1 sentence, max 22 words.`,
    ``,
    `Brief: ${brief}`,
  ].join("\n");
}

/** Simple prompt builder for the generateFeatures server action. */
export function buildFeaturesPrompt(serviceName: string): string {
  return `You are a marketing copywriter. Generate exactly 6 compelling features for a service called "${serviceName}".
Return ONLY a valid JSON array (no prose, no markdown) with this shape:
[{"title":"...","description":"...","icon":"RiXxxLine"}]
- title: ≤6 words
- description: 1 sentence, ≤20 words
- icon: a valid react-icons/ri icon name ending in "Line"`;
}

/** Parse raw model response into an array of feature objects. */
export function normalizeFeaturesResponse(raw: string): { title: string; description: string; icon: string }[] {
  try {
    const parsed = JSON.parse(raw.trim());
    if (Array.isArray(parsed)) return parsed as { title: string; description: string; icon: string }[];
  } catch {}
  const match = raw.match(/\[[\s\S]*\]/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed)) return parsed as { title: string; description: string; icon: string }[];
    } catch {}
  }
  return [];
}
