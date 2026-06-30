"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";

async function requireSuperAdmin() {
  const s = await auth();
  if ((s?.user as any)?.role !== "SUPER_ADMIN") throw new Error("Forbidden");
}

export async function updateCmsPage(slug: string, i18n: unknown, status: string): Promise<void> {
  await requireSuperAdmin();
  const title = (i18n as any)?.title?.el ?? slug;
  const content = (i18n as any)?.body?.el ?? "";
  await db.cMSPage.upsert({
    where: { slug },
    update: { i18n: i18n as any, status, title, content },
    create: {
      slug,
      i18n: i18n as any,
      status,
      title,
      content,
      publishedAt: status === "PUBLISHED" ? new Date() : null,
    },
  });
  revalidatePath("/");
  revalidatePath(`/${slug === "home" ? "" : slug}`);
  revalidatePath("/super-admin/cms/pages");
}

export async function updatePricingTier(id: string, data: Record<string, unknown>): Promise<void> {
  await requireSuperAdmin();
  await db.pricingTier.update({ where: { id }, data: data as any });
  revalidatePath("/");
  revalidatePath("/pricing");
  revalidatePath("/super-admin/cms/pricing");
}

export async function createPricingTier(data: Record<string, unknown>): Promise<void> {
  await requireSuperAdmin();
  await db.pricingTier.create({ data: data as any });
  revalidatePath("/pricing");
  revalidatePath("/super-admin/cms/pricing");
}

export async function deletePricingTier(id: string): Promise<void> {
  await requireSuperAdmin();
  await db.pricingTier.delete({ where: { id } });
  revalidatePath("/pricing");
  revalidatePath("/super-admin/cms/pricing");
}

export async function updateFaq(id: string, data: Record<string, unknown>): Promise<void> {
  await requireSuperAdmin();
  await db.fAQ.update({ where: { id }, data: data as any });
  revalidatePath("/faq");
  revalidatePath("/super-admin/cms/faq");
}

export async function createFaq(data: Record<string, unknown>): Promise<void> {
  await requireSuperAdmin();
  await db.fAQ.create({ data: data as any });
  revalidatePath("/faq");
  revalidatePath("/super-admin/cms/faq");
}

export async function deleteFaq(id: string): Promise<void> {
  await requireSuperAdmin();
  await db.fAQ.delete({ where: { id } });
  revalidatePath("/faq");
  revalidatePath("/super-admin/cms/faq");
}
