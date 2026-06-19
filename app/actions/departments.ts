"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const user = await db.user.findUnique({
    where: { id: session.user.id as string },
    select: { role: true },
  });
  if (!["SUPER_ADMIN", "ADMIN"].includes(user?.role ?? "")) throw new Error("Forbidden");
}

export async function createDepartment(companyId: string, data: {
  name: string;
  description?: string;
  isActive?: boolean;
  sortOrder?: number;
}) {
  await requireSuperAdmin();
  const dept = await db.department.create({
    data: { companyId, ...data },
  });
  revalidatePath(`/super-admin/companies/${companyId}`);
  revalidatePath("/super-admin/settings/company");
  return { department: dept };
}

export async function updateDepartment(id: string, data: {
  name?: string;
  description?: string;
  isActive?: boolean;
  sortOrder?: number;
}) {
  await requireSuperAdmin();
  const dept = await db.department.update({ where: { id }, data });
  revalidatePath(`/super-admin/companies/${dept.companyId}`);
  revalidatePath("/super-admin/settings/company");
  return { department: dept };
}

export async function deleteDepartment(id: string) {
  await requireSuperAdmin();
  const dept = await db.department.findUnique({ where: { id }, select: { companyId: true } });
  await db.department.delete({ where: { id } });
  revalidatePath(`/super-admin/companies/${dept?.companyId}`);
  revalidatePath("/super-admin/settings/company");
  return { success: true };
}
