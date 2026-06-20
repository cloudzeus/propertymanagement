import { env } from "@/lib/env";
import { logAPIUsage } from "@/lib/api-costs";

export function buildMinutesPrompt(transcript: string, buildingName: string): string {
  return [
    `Είσαι γραμματέας γενικής συνέλευσης πολυκατοικίας ("${buildingName}").`,
    `Με βάση το παρακάτω απομαγνητοφωνημένο κείμενο, σύνταξε επίσημα ΠΡΑΚΤΙΚΑ (MOM) στα ελληνικά.`,
    `Δομή: Θέματα Ημερήσιας Διάταξης, Συζήτηση ανά θέμα, Αποφάσεις, Εκκρεμότητες.`,
    `Επέστρεψε ΜΟΝΟ έγκυρο HTML (χωρίς markdown, χωρίς code fences), έτοιμο για email.`,
    ``,
    `--- TRANSCRIPT ---`,
    transcript,
  ].join("\n");
}

export type MinutesResult = { success: boolean; html?: string; tokens: number; error?: string };

/** Calls DeepSeek and logs token cost against the assembly's customer/building. */
export async function generateMinutesHtml(args: {
  transcript: string;
  buildingName: string;
  ctx: { companyId?: string; customerId?: string; buildingId?: string; assemblyId?: string; userId?: string };
}): Promise<MinutesResult> {
  if (!env.DEEPSEEK_API_KEY) return { success: false, tokens: 0, error: "DeepSeek key missing" };

  const model = "deepseek-chat";
  const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.DEEPSEEK_API_KEY}` },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: buildMinutesPrompt(args.transcript, args.buildingName) }],
      temperature: 0.3,
      max_tokens: 4000,
    }),
  });

  if (!res.ok) {
    await logAPIUsage({ apiName: "deepseek", endpoint: "/chat/completions", model, status: "FAILED", errorMessage: `HTTP ${res.status}`, ...args.ctx });
    return { success: false, tokens: 0, error: `DeepSeek ${res.status}` };
  }

  const data = (await res.json()) as any;
  const tokens = data.usage?.total_tokens ?? 0;
  await logAPIUsage({ apiName: "deepseek", endpoint: "/chat/completions", model, tokensUsed: tokens, status: "SUCCESS", ...args.ctx });

  return { success: true, html: data.choices?.[0]?.message?.content ?? "", tokens };
}
