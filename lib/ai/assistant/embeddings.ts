import { env } from "@/lib/env";
import { logAPIUsage } from "@/lib/api-costs";

export const EMBEDDING_MODEL = "gemini-embedding-001";
export const EMBEDDING_DIMS = 768;
const BATCH = 100;
const URL = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:batchEmbedContents`;

export type EmbedTaskType = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

/** Gemini embeddings (768 dims). Returns null when no API key is configured. Cost-logged per call. */
export async function embedTexts(texts: string[], taskType: EmbedTaskType, meta: { userId?: string; customerId?: string } = {}): Promise<number[][] | null> {
  if (!env.GEMINI_API_KEY) return null;
  if (texts.length === 0) return [];
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    const slice = texts.slice(i, i + BATCH);
    const approxTokens = Math.ceil(slice.reduce((s, t) => s + t.length, 0) / 4);
    const res = await fetch(URL, {
      method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY }, cache: "no-store",
      body: JSON.stringify({ requests: slice.map((text) => ({ model: `models/${EMBEDDING_MODEL}`, content: { parts: [{ text }] }, taskType, outputDimensionality: EMBEDDING_DIMS })) }),
    });
    if (!res.ok) {
      await logAPIUsage({ apiName: "gemini", endpoint: "/batchEmbedContents", model: EMBEDDING_MODEL, tokensUsed: approxTokens, status: "FAILED", errorMessage: `HTTP ${res.status}`, userId: meta.userId, customerId: meta.customerId });
      throw new Error(`Gemini embeddings error ${res.status}`);
    }
    const json = (await res.json()) as { embeddings?: { values: number[] }[] };
    const vectors = (json.embeddings ?? []).map((e) => e.values);
    if (vectors.length !== slice.length) throw new Error("Gemini embeddings: unexpected response size");
    out.push(...vectors);
    await logAPIUsage({ apiName: "gemini", endpoint: "/batchEmbedContents", model: EMBEDDING_MODEL, tokensUsed: approxTokens, status: "SUCCESS", userId: meta.userId, customerId: meta.customerId });
  }
  return out;
}

export const toVectorLiteral = (v: number[]) => `[${v.join(",")}]`;
