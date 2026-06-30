import { db } from "@/lib/db";
import { UsersClient } from "./UsersClient";

export const metadata = { title: "Χρήστες — Super Admin" };

export default async function UsersPage() {
  const [users, companies] = await Promise.all([
    db.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true, name: true, email: true, role: true, status: true,
        companyId: true, lastLoginAt: true,
        company: { select: { name: true } },
      },
    }),
    db.company.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  // Single-tenant managing company — used as the default for staff roles.
  const managing = await db.company.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });

  return <UsersClient initial={users} companies={companies} managingCompanyId={managing?.id ?? ""} />;
}
