"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { USER_ROLES, USER_STATUSES, EMPLOYEE_ROLES } from "@/lib/roles-constants";

/** Staff roles default to the single-tenant managing company when none is set. */
async function resolveCompanyId(role: string | undefined, companyId: string | null | undefined): Promise<string | null> {
  if (companyId) return companyId;
  if (role && (EMPLOYEE_ROLES as readonly string[]).includes(role)) {
    const managing = await db.company.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
    return managing?.id ?? null;
  }
  return companyId ?? null;
}

async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const user = await db.user.findUnique({
    where: { id: session.user.id as string },
    select: { role: true },
  });
  if (user?.role !== "SUPER_ADMIN") throw new Error("Forbidden");
}

type UserInput = {
  name?: string | null;
  email: string;
  role: string;
  status?: string;
  companyId?: string | null;
  password?: string | null;
};

export async function createUser(data: UserInput) {
  await requireSuperAdmin();
  const email = data.email.trim().toLowerCase();
  if (!email) return { error: "Το email είναι υποχρεωτικό" };
  if (!data.password || data.password.length < 6) {
    return { error: "Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες" };
  }
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return { error: "Υπάρχει ήδη χρήστης με αυτό το email" };

  const user = await db.user.create({
    data: {
      email,
      name: data.name?.trim() || null,
      role: data.role as any,
      status: (data.status ?? "ACTIVE") as any,
      companyId: await resolveCompanyId(data.role, data.companyId),
      passwordHash: await bcrypt.hash(data.password, 10),
    },
    include: { company: { select: { name: true } } },
  });
  revalidatePath("/super-admin/users");
  return { user };
}

export async function updateUser(id: string, data: Partial<UserInput>) {
  await requireSuperAdmin();
  const patch: Record<string, unknown> = {};
  if (data.name !== undefined) patch.name = data.name?.trim() || null;
  if (data.email !== undefined) patch.email = data.email.trim().toLowerCase();
  if (data.role !== undefined) patch.role = data.role;
  if (data.status !== undefined) patch.status = data.status;
  if (data.companyId !== undefined) patch.companyId = data.companyId || null;
  if (data.password) patch.passwordHash = await bcrypt.hash(data.password, 10);

  // Staff roles must belong to the managing company if left empty.
  if (data.role !== undefined && (EMPLOYEE_ROLES as readonly string[]).includes(data.role) && !patch.companyId) {
    patch.companyId = await resolveCompanyId(data.role, null);
  }

  const user = await db.user.update({
    where: { id },
    data: patch,
    include: { company: { select: { name: true } } },
  });
  revalidatePath("/super-admin/users");
  return { user };
}

export async function deleteUser(id: string) {
  await requireSuperAdmin();
  const session = await auth();
  if (session?.user?.id === id) return { error: "Δεν μπορείτε να διαγράψετε τον εαυτό σας" };
  await db.user.delete({ where: { id } });
  revalidatePath("/super-admin/users");
  return { success: true };
}
