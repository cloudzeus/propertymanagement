"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getScope } from "@/lib/scope";

async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const user = await db.user.findUnique({
    where: { id: session.user.id as string },
    select: { role: true },
  });
  if (!["SUPER_ADMIN", "ADMIN"].includes(user?.role ?? "")) throw new Error("Forbidden");
}

type EmployeeData = {
  userId?: string | null;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  employeeCode?: string | null;
  departmentId?: string | null;
  jobPositionId?: string | null;
  hireDate?: string | null;
  terminationDate?: string | null;
  status?: "ACTIVE" | "INACTIVE" | "ON_LEAVE" | "TERMINATED";
  afm?: string | null;
  amka?: string | null;
  ikaNumber?: string | null;
  address?: string | null;
  city?: string | null;
  postalCode?: string | null;
};

export async function createEmployee(companyId: string, data: EmployeeData) {
  await requireSuperAdmin();
  const emp = await db.employee.create({
    data: {
      companyId,
      ...data,
      hireDate: data.hireDate ? new Date(data.hireDate) : null,
      terminationDate: data.terminationDate ? new Date(data.terminationDate) : null,
    },
    include: {
      department: { select: { name: true } },
      jobPosition: { select: { title: true } },
      user: { select: { id: true, name: true, email: true } },
    },
  });
  revalidatePath(`/super-admin/companies/${companyId}`);
  revalidatePath("/super-admin/settings/company");
  return { employee: emp };
}

export async function updateEmployee(id: string, data: Partial<EmployeeData>) {
  await requireSuperAdmin();
  const emp = await db.employee.update({
    where: { id },
    data: {
      ...data,
      hireDate: data.hireDate !== undefined ? (data.hireDate ? new Date(data.hireDate) : null) : undefined,
      terminationDate: data.terminationDate !== undefined ? (data.terminationDate ? new Date(data.terminationDate) : null) : undefined,
    },
    include: {
      department: { select: { name: true } },
      jobPosition: { select: { title: true } },
      user: { select: { id: true, name: true, email: true } },
    },
  });
  revalidatePath(`/super-admin/companies/${emp.companyId}`);
  revalidatePath("/super-admin/settings/company");
  return { employee: emp };
}

export async function deleteEmployee(id: string) {
  await requireSuperAdmin();
  const emp = await db.employee.findUnique({ where: { id }, select: { companyId: true } });
  await db.employee.delete({ where: { id } });
  revalidatePath(`/super-admin/companies/${emp?.companyId}`);
  revalidatePath("/super-admin/settings/company");
  return { success: true };
}

export type UserOption = { id: string; name: string | null; email: string; role: string };

/** Search application users for a combo box.
 *  Optionally restrict to specific roles and/or a single customer.
 *  Data isolation: a non-staff caller is always confined to their own customer,
 *  and staff callers may pass `customerId` to scope the picker to one customer. */
export async function searchUsers(query: string, roles?: readonly string[], customerId?: string): Promise<UserOption[]> {
  const scope = await getScope();
  const q = query.trim();
  // Non-staff → forced to own customer. Staff → optional explicit customer filter.
  const scopeCustomerId = scope.seesAllCustomers ? customerId : (scope.customerId ?? "__no_customer__");
  const users = await db.user.findMany({
    where: {
      ...(roles && roles.length ? { role: { in: roles as any } } : {}),
      ...(scopeCustomerId ? { customerId: scopeCustomerId } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: { id: true, name: true, email: true, role: true },
    orderBy: [{ name: "asc" }, { email: "asc" }],
    take: 25,
  });
  return users;
}
