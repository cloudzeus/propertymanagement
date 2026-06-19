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

const isEmpty = (v: unknown) => v == null || v === "";

/**
 * Non-destructive merge: start from the Gemini (`base`) result and only fill
 * fields the model left empty with the DeepSeek (`extra`) value. DeepSeek can
 * ADD information but must never erase what the vision pass already found.
 * Confidence is kept from `base` unless it was missing.
 */
function mergeFill(base: ExtractedDoc, extra: ExtractedDoc): ExtractedDoc {
  const out: ExtractedDoc = { ...base };
  for (const k of Object.keys(base) as (keyof ExtractedDoc)[]) {
    if (k === "meter" || k === "confidence") continue;
    if (isEmpty(out[k]) && !isEmpty(extra[k])) (out[k] as unknown) = extra[k];
  }
  // Meter: prefer base; fill its empty sub-fields from extra; keep a meter if either has one.
  if (base.meter || extra.meter) {
    const bm = base.meter ?? ({} as NonNullable<ExtractedDoc["meter"]>);
    const em = extra.meter ?? ({} as NonNullable<ExtractedDoc["meter"]>);
    const meter = { ...em, ...Object.fromEntries(Object.entries(bm).filter(([, v]) => !isEmpty(v))) } as NonNullable<ExtractedDoc["meter"]>;
    out.meter = meter;
  }
  return out;
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
          { role: "system", content: `Σου δίνονται προ-εξαγμένα δεδομένα παραστατικού (extracted) και το ακατέργαστο κείμενο (rawText). ΜΗΝ διαγράψεις/μηδενίσεις σωστές υπάρχουσες τιμές — μόνο συμπλήρωσε όσα λείπουν (null) και διόρθωσε προφανή λάθη μορφής. Επίστρεψε το ίδιο JSON schema. suggestedCategoryCode ένα από: ${validCodes.join(", ")} ή null. Ημερομηνίες YYYY-MM-DD, ποσά ως αριθμοί.` },
          { role: "user", content: JSON.stringify({ extracted: doc, rawText }) },
        ],
      }),
    });
    if (res.ok) {
      const data = await res.json();
      const u = data?.usage ?? {};
      logDeepSeek({ model: "deepseek-chat", tokens: u.total_tokens ?? null });
      const cleaned = ExtractedDocSchema.parse(parseJsonLoose(data?.choices?.[0]?.message?.content ?? ""));
      // Merge: DeepSeek may only fill gaps, never overwrite Gemini's findings.
      result = mergeFill(doc, cleaned);
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
