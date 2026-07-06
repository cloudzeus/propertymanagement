import { requirePermission } from "@/lib/rbac/permissions";
import { db } from "@/lib/db";
import { RBAC_MODULES } from "@/lib/rbac/registry";
import { RoleEditor } from "./role-editor";

export const metadata = { title: "Ρόλοι — Super Admin" };

export default async function RolesPage() {
  await requirePermission("roles", "edit");
  const roles = await db.role.findMany({
    orderBy: [{ isSystem: "desc" }, { label: "asc" }],
    include: { permissions: { select: { moduleKey: true, action: true } }, _count: { select: { users: true } } },
  });
  const data = roles.map((r) => ({
    id: r.id, key: r.key, label: r.label, baseRole: r.baseRole, surface: r.surface,
    isSystem: r.isSystem, userCount: r._count.users,
    perms: r.permissions.map((p) => `${p.moduleKey}:${p.action}`),
  }));
  const modules = RBAC_MODULES.map((m) => ({ key: m.key, label: m.label, surface: m.surface, actions: [...m.actions] }));
  return <RoleEditor roles={data} modules={modules} />;
}
