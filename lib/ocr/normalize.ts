import { env } from "@/lib/env";
import { fetchWithRetry } from "./fetch-retry";
import { logDeepSeek } from "./cost";
import { parseJsonLoose } from "./extract";
import { ExtractedDocSchema, type ExtractedDoc } from "./prompt";

export function computeConsumption(current: number | null, previous: number | null): number | null {
  if (current == null || previous == null) return null;
  const c = current - previous;
  return c >= 0 ? c : null;
}

export function pickCategory(code: string | null, validCodes: string[]): string | null {
  if (!code) return null;
  return validCodes.includes(code) ? code : null;
}

const DEEPSEEK_URL = process.env.DEEPSEEK_API_URL ?? "https://api.deepseek.com/v1/chat/completions";

export async function normalizeExtraction(doc: ExtractedDoc, rawText: string, validCodes: string[]): Promise<ExtractedDoc> {
  let result = doc;
  try {
    const res = await fetchWithRetry(DEEPSEEK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.DEEPSEEK_API_KEY}` },
      body: JSON.stringify({
        model: "deepseek-chat", temperature: 0.1, response_format: { type: "json_object" },
        messages: [
          { role: "system", content: `Καθάρισε και κανονικοποίησε τα εξαγμένα δεδομένα παραστατικού. Επίστρεψε το ίδιο JSON schema. Το suggestedCategoryCode πρέπει να είναι ένα από: ${validCodes.join(", ")} ή null. Ημερομηνίες σε YYYY-MM-DD, ποσά ως αριθμοί.` },
          { role: "user", content: JSON.stringify({ extracted: doc, rawText }) },
        ],
      }),
    });
    if (res.ok) {
      const data = await res.json();
      const u = data?.usage ?? {};
      logDeepSeek({ model: "deepseek-chat", tokens: u.total_tokens ?? null });
      result = ExtractedDocSchema.parse(parseJsonLoose(data?.choices?.[0]?.message?.content ?? ""));
    } else {
      logDeepSeek({ model: "deepseek-chat", tokens: null, status: "FAILED" });
    }
  } catch {
    logDeepSeek({ model: "deepseek-chat", tokens: null, status: "FAILED" });
  }

  result.suggestedCategoryCode = pickCategory(result.suggestedCategoryCode, validCodes);
  if (result.meter) {
    result.meter.consumption = result.meter.consumption ?? computeConsumption(result.meter.currentReading, result.meter.previousReading);
  }
  return result;
}
