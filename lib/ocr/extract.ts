import sharp from "sharp";
import { env } from "@/lib/env";
import { fetchWithRetry } from "./fetch-retry";
import { buildModelChain, tryModels } from "./model-fallback";
import { logGemini } from "./cost";
import { buildSystemPrompt, ExtractedDocSchema, countMissingRequired, type ExtractedDoc } from "./prompt";

const VISION_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const PRIMARY_MODEL = "gemini-2.5-flash";
const FALLBACK_MODELS = ["gemini-2.0-flash", "gemini-2.5-flash-lite"];
const UPGRADED_MODEL = "gemini-2.5-pro";
const RETRY_MISSING_THRESHOLD = 2;

export function parseJsonLoose(s: string): any {
  if (!s) throw new Error("Empty LLM response");
  const cleaned = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try { return JSON.parse(cleaned); } catch {}
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
  throw new Error("LLM did not return valid JSON");
}

export async function enhanceForOcr(input: Buffer): Promise<{ buffer: Buffer; mimeType: string }> {
  try {
    const meta = await sharp(input).metadata();
    const w = meta.width ?? 0;
    let pipe = sharp(input, { failOn: "none" });
    if (w > 0 && w < 1600) pipe = pipe.resize({ width: 1600, kernel: "lanczos3" });
    const out = await pipe.rotate().grayscale().normalize().sharpen({ sigma: 1 }).png({ compressionLevel: 8 }).toBuffer();
    return { buffer: out, mimeType: "image/png" };
  } catch {
    return { buffer: input, mimeType: "image/png" };
  }
}

async function callVision(system: string, dataUrl: string, model: string): Promise<{ content: string; tokens: number | null; model: string }> {
  return tryModels(buildModelChain(model, FALLBACK_MODELS), async (m) => {
    try {
      const res = await fetchWithRetry(VISION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.GEMINI_API_KEY}` },
        body: JSON.stringify({
          model: m, temperature: 0.1, response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: [{ type: "image_url", image_url: { url: dataUrl } }, { type: "text", text: "Εξήγαγε τα δεδομένα σε JSON." }] },
          ],
        }),
      }, { label: `vision:${m}` });
      if (!res.ok) { logGemini({ model: m, tokens: null, status: "FAILED" }); return { ok: false, error: new Error(`Vision ${res.status}: ${(await res.text()).slice(0, 200)}`) }; }
      const data = await res.json();
      const u = data?.usage ?? {};
      logGemini({ model: m, tokens: u.total_tokens ?? null });
      return { ok: true, value: { content: data?.choices?.[0]?.message?.content ?? "", tokens: u.total_tokens ?? null, model: m } };
    } catch (err) {
      logGemini({ model: m, tokens: null, status: "FAILED" });
      return { ok: false, error: err instanceof Error ? err : new Error(String(err)) };
    }
  });
}

async function callPdfNative(system: string, pdf: Buffer, model: string): Promise<{ content: string; tokens: number | null; model: string }> {
  const b64 = pdf.toString("base64");
  return tryModels(buildModelChain(model, FALLBACK_MODELS), async (m) => {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent?key=${env.GEMINI_API_KEY}`;
      const res = await fetchWithRetry(url, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ inline_data: { mime_type: "application/pdf", data: b64 } }, { text: "Εξήγαγε τα δεδομένα σε JSON." }] }],
          generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
        }),
      }, { label: `pdf:${m}` });
      if (!res.ok) { logGemini({ model: m, tokens: null, status: "FAILED" }); return { ok: false, error: new Error(`PDF ${res.status}: ${(await res.text()).slice(0, 200)}`) }; }
      const data = await res.json();
      const content = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).filter(Boolean).join("") ?? "";
      const u = data?.usageMetadata ?? {};
      logGemini({ model: m, tokens: u.totalTokenCount ?? null });
      return { ok: true, value: { content, tokens: u.totalTokenCount ?? null, model: m } };
    } catch (err) {
      logGemini({ model: m, tokens: null, status: "FAILED" });
      return { ok: false, error: err instanceof Error ? err : new Error(String(err)) };
    }
  });
}

export type ExtractOutput = { data: ExtractedDoc; rawText: string; model: string };

export async function extractDocument(args: { buffer: Buffer; mimeType: string; categoryCodes: string[] }): Promise<ExtractOutput> {
  const system = buildSystemPrompt(args.categoryCodes);
  const isPdf = args.mimeType === "application/pdf";

  const run = async (model: string) => {
    if (isPdf) return callPdfNative(system, args.buffer, model);
    const enhanced = await enhanceForOcr(args.buffer);
    const dataUrl = `data:${enhanced.mimeType};base64,${enhanced.buffer.toString("base64")}`;
    return callVision(system, dataUrl, model);
  };

  let res = await run(PRIMARY_MODEL);
  let parsed = ExtractedDocSchema.parse(parseJsonLoose(res.content));
  if (countMissingRequired(parsed) > RETRY_MISSING_THRESHOLD) {
    try {
      const retry = await run(UPGRADED_MODEL);
      const reparsed = ExtractedDocSchema.parse(parseJsonLoose(retry.content));
      if (countMissingRequired(reparsed) < countMissingRequired(parsed)) { res = retry; parsed = reparsed; }
    } catch { /* keep first result */ }
  }
  return { data: parsed, rawText: res.content, model: res.model };
}
