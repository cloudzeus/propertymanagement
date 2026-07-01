"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { deepseekComplete } from "@/lib/ai";
import { ICON_NAMES } from "@/lib/cms/icon-registry";
import { buildFeaturePrompt, normalizeFeatureItems, type FeatureItem } from "@/lib/ai/features";
import { buildSeoPrompt, normalizeSeo, type GeneratedSeo } from "@/lib/ai/seo";
import { getPageContext } from "@/lib/cms/seo-context";
import { buildTopicsPrompt, normalizeTopics, buildDraftPrompt, normalizeDraft, type Topic } from "@/lib/ai/articles";
import type { Locale } from "@/i18n";

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

export async function generateSeo(slug: string, brief: string, locale: Locale): Promise<GeneratedSeo> {
  await requireSuperAdmin();
  const settings = await db.siteSettings.findUnique({ where: { id: "singleton" } });
  const siteName = settings?.siteName ?? "Orithon";
  const context = await getPageContext(slug, locale);
  const text = await deepseekComplete(buildSeoPrompt(context, brief, locale, siteName));
  return normalizeSeo(text);
}

export async function suggestArticleTopics(theme: string, count: number): Promise<Topic[]> {
  await requireSuperAdmin();
  const n = Math.min(Math.max(Math.round(count) || 5, 1), 8);
  const rows = await db.article.findMany({ select: { i18n: true }, take: 40, orderBy: { updatedAt: "desc" } });
  const titles = rows
    .map((r) => {
      const i = (r.i18n ?? {}) as any;
      return String(i?.title?.el ?? i?.title?.en ?? "").trim();
    })
    .filter(Boolean);
  const text = await deepseekComplete(buildTopicsPrompt(theme, titles, n));
  return normalizeTopics(text).slice(0, n);
}

export async function generateArticleDraft(
  title: string,
  angle: string,
  locale: Locale,
): Promise<{ excerpt: string; body: string }> {
  await requireSuperAdmin();
  const text = await deepseekComplete(buildDraftPrompt(title, angle, locale));
  return normalizeDraft(text);
}
