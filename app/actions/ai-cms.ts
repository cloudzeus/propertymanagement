"use server";

import { auth } from "@/auth";
import { deepseekComplete } from "@/lib/ai";
import { ICON_NAMES } from "@/lib/cms/icon-registry";
import { buildFeaturePrompt, normalizeFeatureItems, type FeatureItem } from "@/lib/ai/features";

async function requireSuperAdmin() {
  const session = await auth();
  if ((session?.user as { role?: string } | undefined)?.role !== "SUPER_ADMIN") {
    throw new Error("Forbidden");
  }
}

function extractJsonArray(text: string): unknown {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start < 0 || end < 0 || end <= start) return [];
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return [];
  }
}

export async function generateFeatures(
  brief: string,
  count: number,
  locale: "el" | "en",
): Promise<FeatureItem[]> {
  await requireSuperAdmin();
  const n = Math.min(Math.max(Math.round(count) || 3, 1), 8);
  const fallbackIcon = ICON_NAMES[0] ?? "";
  const prompt = buildFeaturePrompt(brief.trim().slice(0, 1000), n, locale, ICON_NAMES);
  const text = await deepseekComplete(prompt);
  return normalizeFeatureItems(extractJsonArray(text), ICON_NAMES, fallbackIcon).slice(0, n);
}
