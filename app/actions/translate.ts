"use server";
import { auth } from "@/auth";
import { translateText } from "@/lib/ai/translate";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

async function requireSuperAdmin() {
  const s = await auth();
  if ((s?.user as any)?.role !== "SUPER_ADMIN") throw new Error("Forbidden");
}

export async function autoTranslate(text: string, from: string, to: string): Promise<string> {
  await requireSuperAdmin();
  return translateText(text, from, to);
}

export async function updateUiMessages(entries: { key: string; el: string; en: string }[]): Promise<void> {
  await requireSuperAdmin();
  for (const e of entries) {
    await db.uiMessage.upsert({
      where: { key: e.key },
      update: { el: e.el, en: e.en },
      create: { key: e.key, el: e.el, en: e.en },
    });
  }
  revalidatePath("/", "layout");
}
