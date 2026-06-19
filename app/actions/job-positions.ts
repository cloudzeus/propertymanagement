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

export async function createJobPosition(companyId: string, data: {
  title: string;
  departmentId?: string | null;
  description?: string;
  level?: string;
  isActive?: boolean;
}) {
  await requireSuperAdmin();
  const pos = await db.jobPosition.create({
    data: { companyId, ...data },
    include: { department: { select: { name: true } } },
  });
  revalidatePath(`/super-admin/companies/${companyId}`);
  revalidatePath("/super-admin/settings/company");
  return { position: pos };
}

export async function updateJobPosition(id: string, data: {
  title?: string;
  departmentId?: string | null;
  description?: string;
  level?: string;
  isActive?: boolean;
}) {
  await requireSuperAdmin();
  const pos = await db.jobPosition.update({
    where: { id },
    data,
    include: { department: { select: { name: true } } },
  });
  revalidatePath(`/super-admin/companies/${pos.companyId}`);
  revalidatePath("/super-admin/settings/company");
  return { position: pos };
}

export async function deleteJobPosition(id: string) {
  await requireSuperAdmin();
  const pos = await db.jobPosition.findUnique({ where: { id }, select: { companyId: true } });
  await db.jobPosition.delete({ where: { id } });
  revalidatePath(`/super-admin/companies/${pos?.companyId}`);
  revalidatePath("/super-admin/settings/company");
  return { success: true };
}
