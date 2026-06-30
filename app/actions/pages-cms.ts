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
