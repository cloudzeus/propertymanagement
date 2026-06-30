"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";

async function requireSuperAdmin() { const s = await auth(); if ((s?.user as any)?.role !== "SUPER_ADMIN") throw new Error("Forbidden"); }

function slugify(s: string): string {
  return (s || "").toLowerCase().trim()
    .replace(/[^a-z0-9α-ω\s-]/gi, "")
    .replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || `item-${Math.random().toString(36).slice(2,8)}`;
}

function revalBlog() { revalidatePath("/blog"); revalidatePath("/"); revalidatePath("/super-admin/cms/articles"); }

export async function createArticle(data: Record<string, unknown>): Promise<string> {
  await requireSuperAdmin();
  const i18n = (data.i18n as any) ?? {};
  const slug = (data.slug as string) || slugify(i18n?.title?.el || i18n?.title?.en || "article");
  const row = await db.article.create({ data: { ...(data as any), slug } });
  revalBlog();
  return row.id;
}
export async function updateArticle(id: string, data: Record<string, unknown>): Promise<void> {
  await requireSuperAdmin();
  await db.article.update({ where: { id }, data: data as any });
  revalBlog(); revalidatePath(`/blog/${(data as any).slug ?? ""}`);
}
export async function deleteArticle(id: string): Promise<void> {
  await requireSuperAdmin();
  await db.article.delete({ where: { id } });
  revalBlog();
}
export async function createAuthor(data: Record<string, unknown>): Promise<string> {
  await requireSuperAdmin();
  const slug = (data.slug as string) || slugify((data.name as string) || "author");
  const row = await db.author.create({ data: { ...(data as any), slug } });
  revalidatePath("/super-admin/cms/authors"); revalidatePath("/blog");
  return row.id;
}
export async function updateAuthor(id: string, data: Record<string, unknown>): Promise<void> {
  await requireSuperAdmin();
  await db.author.update({ where: { id }, data: data as any });
  revalidatePath("/super-admin/cms/authors"); revalidatePath("/blog");
}
export async function deleteAuthor(id: string): Promise<void> {
  await requireSuperAdmin();
  await db.author.delete({ where: { id } });
  revalidatePath("/super-admin/cms/authors");
}
