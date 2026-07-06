import { db } from "@/lib/db";
import { USER_ROLES, ROLE_LABELS } from "@/lib/roles-constants";
import { surfaceForRole } from "@/lib/surfaces";
import { defaultPermissionsFor } from "@/lib/rbac/permissions";
import type { UserRole } from "@/lib/prisma/enums";

async function main() {
  for (const role of USER_ROLES as readonly UserRole[]) {
    const existing = await db.role.upsert({
      where: { key: role },
      update: {},
      create: {
        key: role,
        label: ROLE_LABELS[role] ?? role,
        baseRole: role,
        surface: surfaceForRole(role),
        isSystem: true,
      },
      include: { permissions: { select: { id: true } } },
    });
    if (existing.permissions.length === 0) {
      const keys = defaultPermissionsFor(role);
      await db.rolePermission.createMany({
        data: keys.map((k) => {
          const [moduleKey, action] = k.split(":");
          return { roleId: existing.id, moduleKey, action };
        }),
        skipDuplicates: true,
      });
      console.log(`seeded ${keys.length} perms for ${role}`);
    }
  }

  const sysRoles = await db.role.findMany({ where: { isSystem: true }, select: { id: true, key: true } });
  const byKey = new Map(sysRoles.map((r) => [r.key, r.id]));
  const users = await db.user.findMany({ where: { roleId: null }, select: { id: true, role: true } });
  for (const u of users) {
    const rid = byKey.get(u.role);
    if (rid) await db.user.update({ where: { id: u.id }, data: { roleId: rid } });
  }
  console.log(`backfilled ${users.length} users`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
