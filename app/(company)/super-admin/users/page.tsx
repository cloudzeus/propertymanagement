import { db } from "@/lib/db";
import { requirePermission } from "@/lib/rbac/permissions";
import { UsersClient } from "./UsersClient";

export const metadata = { title: "Χρήστες — Super Admin" };

export default async function UsersPage() {
  await requirePermission("users", "view");
  const [users, companies, roles] = await Promise.all([
    db.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true, name: true, email: true, role: true, roleId: true, status: true,
        companyId: true, lastLoginAt: true,
        company: { select: { name: true } },
      },
    }),
    db.company.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.role.findMany({
      orderBy: [{ isSystem: "desc" }, { label: "asc" }],
      select: { id: true, key: true, label: true, baseRole: true, surface: true, isSystem: true },
    }),
  ]);

  // Single-tenant managing company — used as the default for staff roles.
  const managing = await db.company.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });

  return <UsersClient initial={users} companies={companies} roles={roles} managingCompanyId={managing?.id ?? ""} />;
}
