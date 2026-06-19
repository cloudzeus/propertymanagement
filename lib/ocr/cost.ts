import { logAPIUsage } from "@/lib/api-costs";

type Usage = { model: string; tokens: number | null; status?: "SUCCESS" | "FAILED" };

export function logGemini(u: Usage) {
  void logAPIUsage({ apiName: "gemini", endpoint: "/ocr", model: u.model, tokensUsed: u.tokens ?? 0, status: u.status ?? "SUCCESS" });
}

export function logDeepSeek(u: Usage) {
  void logAPIUsage({ apiName: "deepseek", endpoint: "/normalize", model: u.model, tokensUsed: u.tokens ?? 0, status: u.status ?? "SUCCESS" });
}
