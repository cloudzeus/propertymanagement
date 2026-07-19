import { db } from "@/lib/db";
import { defaultPermissionsFor } from "@/lib/rbac/permissions";
import { permKey, type RbacAction } from "@/lib/rbac/types";
import type { UserRole } from "@/lib/prisma/enums";

/**
 * Align SYSTEM roles' RolePermission rows exactly with the code defaults
 * (lib/rbac/registry.ts DEFAULT_PERMISSIONS) — adds rows for permissions the
 * registry now grants, removes rows for permissions it no longer grants.
 *
 * Unlike seed-rbac.ts's additive-only backfillNewModules() (which never touches
 * a module the role already has rows for), this is a full sync: run it after
 * regrouping/retiring modules in the registry so the DB catches up exactly.
 *
 * Custom roles (isSystem: false, created via /super-admin/roles) are never
 * touched. Idempotent — running it twice reports +0 −0 for every role.
 */
async function main() {
  const roles = await db.role.findMany({ where: { isSystem: true }, select: { id: true, key: true } });

  for (const role of roles) {
    const wanted = new Set(defaultPermissionsFor(role.key as UserRole));
    const existing = await db.rolePermission.findMany({ where: { roleId: role.id } });
    const keyOf = (r: { moduleKey: string; action: string }) => permKey(r.moduleKey, r.action as RbacAction);
    const have = new Set(existing.map(keyOf));

    const toDelete = existing.filter((r) => !wanted.has(keyOf(r)));
    const toInsert = [...wanted].filter((k) => !have.has(k));

    if (toDelete.length) {
      await db.rolePermission.deleteMany({ where: { id: { in: toDelete.map((r) => r.id) } } });
    }
    if (toInsert.length) {
      await db.rolePermission.createMany({
        data: toInsert.map((k) => {
          const [moduleKey, action] = k.split(":");
          return { roleId: role.id, moduleKey, action };
        }),
        skipDuplicates: true,
      });
    }
    console.log(`${role.key}: +${toInsert.length} −${toDelete.length}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
