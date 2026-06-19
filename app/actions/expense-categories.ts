"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { canManageBuildingExpenses } from "@/lib/expenses/authz";
import { resolveSplit } from "@/lib/expenses/allocation";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const u = await db.user.findUnique({ where: { id: session.user.id as string }, select: { role: true } });
  if (!["SUPER_ADMIN", "ADMIN"].includes(u?.role ?? "")) throw new Error("Forbidden");
  return session.user.id as string;
}

export type CategoryInput = {
  name: string; code: string; utilityType: "NONE" | "POWER" | "WATER" | "GAS";
  defaultTenantPct: number; defaultOwnerPct: number; sortOrder?: number; active?: boolean;
};

function assertSplit(t: number, o: number) {
  if (t < 0 || o < 0 || t + o !== 100) throw new Error("Τα ποσοστά ενοικιαστή/ιδιοκτήτη πρέπει να αθροίζουν 100.");
}

export async function listExpenseCategories() {
  await auth();
  return db.expenseCategory.findMany({ orderBy: [{ active: "desc" }, { sortOrder: "asc" }] });
}

export async function createExpenseCategory(input: CategoryInput) {
  await requireAdmin();
  assertSplit(input.defaultTenantPct, input.defaultOwnerPct);
  const cat = await db.expenseCategory.create({ data: { ...input } });
  revalidatePath("/super-admin/settings/expense-categories");
  return cat;
}

export async function updateExpenseCategory(id: string, input: CategoryInput) {
  await requireAdmin();
  assertSplit(input.defaultTenantPct, input.defaultOwnerPct);
  const cat = await db.expenseCategory.update({ where: { id }, data: { ...input } });
  revalidatePath("/super-admin/settings/expense-categories");
  return cat;
}

export async function deleteExpenseCategory(id: string) {
  await requireAdmin();
  const used = await db.buildingExpense.count({ where: { categoryId: id } });
  if (used > 0) {
    await db.expenseCategory.update({ where: { id }, data: { active: false } });
  } else {
    await db.expenseCategory.delete({ where: { id } });
  }
  revalidatePath("/super-admin/settings/expense-categories");
}

export async function getBuildingCategorySplits(buildingId: string) {
  const session = await auth();
  if (!session?.user || !(await canManageBuildingExpenses(session.user.id as string, buildingId))) throw new Error("Forbidden");
  const [cats, overrides] = await Promise.all([
    db.expenseCategory.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    db.buildingCategoryOverride.findMany({ where: { buildingId } }),
  ]);
  const byCat = new Map(overrides.map((o) => [o.categoryId, o]));
  return cats.map((c) => {
    const ov = byCat.get(c.id) ?? null;
    const split = resolveSplit(c, ov);
    return { category: c, override: ov, effective: split, isOverridden: !!ov };
  });
}

export async function upsertBuildingCategoryOverride(buildingId: string, categoryId: string, tenantPct: number, ownerPct: number) {
  const session = await auth();
  if (!session?.user || !(await canManageBuildingExpenses(session.user.id as string, buildingId))) throw new Error("Forbidden");
  assertSplit(tenantPct, ownerPct);
  await db.buildingCategoryOverride.upsert({
    where: { buildingId_categoryId: { buildingId, categoryId } },
    update: { tenantPct, ownerPct },
    create: { buildingId, categoryId, tenantPct, ownerPct },
  });
  revalidatePath(`/super-admin/buildings/${buildingId}`);
}

export async function clearBuildingCategoryOverride(buildingId: string, categoryId: string) {
  const session = await auth();
  if (!session?.user || !(await canManageBuildingExpenses(session.user.id as string, buildingId))) throw new Error("Forbidden");
  await db.buildingCategoryOverride.deleteMany({ where: { buildingId, categoryId } });
  revalidatePath(`/super-admin/buildings/${buildingId}`);
}
