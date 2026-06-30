"use server";
import { auth } from "@/auth";
import { translateText } from "@/lib/ai/translate";

async function requireSuperAdmin() {
  const s = await auth();
  if ((s?.user as any)?.role !== "SUPER_ADMIN") throw new Error("Forbidden");
}

export async function autoTranslate(text: string, from: string, to: string): Promise<string> {
  await requireSuperAdmin();
  return translateText(text, from, to);
}
