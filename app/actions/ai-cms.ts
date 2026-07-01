"use server";

import { auth } from "@/auth";
import { deepseekComplete } from "@/lib/ai";
import { buildFeaturesPrompt, normalizeFeaturesResponse } from "@/lib/ai/features";

async function requireSuperAdmin() {
  const session = await auth();
  if ((session?.user as any)?.role !== "SUPER_ADMIN") throw new Error("Forbidden");
}

export async function generateFeatures(
  serviceName: string,
): Promise<{ success: true; items: { title: string; description: string; icon: string }[] } | { success: false; error: string }> {
  try {
    await requireSuperAdmin();
    const prompt = buildFeaturesPrompt(serviceName);
    const raw = await deepseekComplete(prompt);
    const items = normalizeFeaturesResponse(raw);
    return { success: true, items };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}
