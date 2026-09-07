"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { syncMediaAcrossLocales } from "@/lib/cms/media-sync";
import {
  MARKETING_PAGE_DEFAULTS,
  MARKETING_PAGE_META,
  isMarketingPageSlug,
  type MarketingPageSlug,
} from "@/lib/cms/marketing-pages";

/** Prisma's Json column input; the blob shape is validated by the typed editor. */
type JsonBlob = Parameters<typeof db.marketingPage.create>[0]["data"]["data"];

async function requireSuperAdmin() {
  const session = await auth();
  if ((session?.user as { role?: string } | undefined)?.role !== "SUPER_ADMIN") {
    throw new Error("Forbidden");
  }
}

export async function updateMarketingPage(slug: string, data: unknown): Promise<void> {
  await requireSuperAdmin();
  // The slug decides which public route is revalidated — never trust it raw.
  if (!isMarketingPageSlug(slug)) throw new Error("Unknown page");
  const synced = syncMediaAcrossLocales(data as Record<string, unknown>) as JsonBlob;
  await db.marketingPage.upsert({
    where: { slug },
    update: { data: synced },
    create: { slug, data: synced },
  });
  revalidatePath(MARKETING_PAGE_META[slug].path);
  revalidatePath("/super-admin/cms/site-pages");
}

/** Restores the built-in handoff copy for one page. */
export async function resetMarketingPage(slug: string): Promise<void> {
  await requireSuperAdmin();
  if (!isMarketingPageSlug(slug)) throw new Error("Unknown page");
  const defaults = MARKETING_PAGE_DEFAULTS[slug as MarketingPageSlug] as unknown as JsonBlob;
  await db.marketingPage.upsert({
    where: { slug },
    update: { data: defaults },
    create: { slug, data: defaults },
  });
  revalidatePath(MARKETING_PAGE_META[slug].path);
  revalidatePath("/super-admin/cms/site-pages");
}
