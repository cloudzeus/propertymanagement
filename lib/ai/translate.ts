import "server-only";
const ENDPOINT = process.env.DEEPSEEK_API_URL || "https://api.deepseek.com/v1/chat/completions";
const LANG: Record<string, string> = { el: "Greek", en: "English" };

export function buildTranslatePrompt(from: string, to: string) {
  const system = `You are a professional translator. Translate from ${LANG[from] ?? from} to ${LANG[to] ?? to}. Preserve markdown formatting and placeholders like {name} or {count} exactly. Return ONLY the translation, no quotes, no commentary.`;
  return { system };
}

export async function translateText(text: string, from: string, to: string): Promise<string> {
  if (!text?.trim()) return text;
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return text;
  const { system } = buildTranslatePrompt(from, to);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: "deepseek-chat", messages: [{ role: "system", content: system }, { role: "user", content: text }], stream: false, temperature: 0.2 }),
    });
    if (!res.ok) return text;
    const data = await res.json();
    return (data?.choices?.[0]?.message?.content ?? text).trim();
  } catch {
    return text;
  }
}

export async function translateBatch(items: string[], from: string, to: string): Promise<string[]> {
  return Promise.all(items.map((t) => translateText(t, from, to)));
}
