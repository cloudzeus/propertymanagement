import "server-only";
import { db } from "@/lib/db";
import type { SeoMeta } from "@/lib/seo/types";
import type { Translatable } from "@/lib/i18n/translatable";

export async function getPageSeo(slug: string): Promise<Translatable<SeoMeta> | null> {
  const row = await db.pageSeo.findUnique({ where: { slug } });
  return (row?.seo as unknown as Translatable<SeoMeta>) ?? null;
}
