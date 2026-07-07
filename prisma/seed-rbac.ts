import { db } from "@/lib/db";
import { USER_ROLES, ROLE_LABELS } from "@/lib/roles-constants";
import { surfaceForRole } from "@/lib/surfaces";
import { defaultPermissionsFor } from "@/lib/rbac/permissions";
import type { UserRole } from "@/lib/prisma/enums";

/**
 * Deploy-safe additive backfill for newly-added modules.
 *
 * The init logic in `main()` only seeds a role that has ZERO permission rows, so
 * modules added to DEFAULT_PERMISSIONS after a role was first seeded never reach
 * already-populated roles on deploy. This pass fixes that at MODULE granularity:
 *
 *  - For each system role in DEFAULT_PERMISSIONS, group its default perm keys by
 *    moduleKey. If the role currently has ZERO rows for a module (brand-new module),
 *    insert that module's default rows. If the role already has ANY row for the
 *    module, skip it entirely — respecting a super-admin's prior customizations /
 *    intentional per-action revokes for modules the role already knows about.
 *
 * Non-destructive (never deletes) and idempotent (running twice is a no-op).
 */
async function backfillNewModules() {
  const sysRoles = await db.role.findMany({ where: { isSystem: true }, select: { id: true, key: true } });
  for (const r of sysRoles) {
    const defaults = defaultPermissionsFor(r.key as UserRole);
    if (defaults.length === 0) continue;

    // Group default perm keys (`${moduleKey}:${action}`) by module.
    const actionsByModule = new Map<string, string[]>();
    for (const k of defaults) {
      const [moduleKey, action] = k.split(":");
      if (!actionsByModule.has(moduleKey)) actionsByModule.set(moduleKey, []);
      actionsByModule.get(moduleKey)!.push(action);
    }

    const existingRows = await db.rolePermission.findMany({
      where: { roleId: r.id },
      select: { moduleKey: true },
    });
    const knownModules = new Set(existingRows.map((e) => e.moduleKey));

    const toInsert: { roleId: string; moduleKey: string; action: string }[] = [];
    const backfilledModules: string[] = [];
    for (const [moduleKey, actions] of actionsByModule) {
      if (knownModules.has(moduleKey)) continue; // role already knows this module — leave it alone
      backfilledModules.push(moduleKey);
      for (const action of actions) toInsert.push({ roleId: r.id, moduleKey, action });
    }

    if (toInsert.length > 0) {
      const res = await db.rolePermission.createMany({ data: toInsert, skipDuplicates: true });
      console.log(`backfilled ${r.key}: [${backfilledModules.join(", ")}] → ${res.count} rows`);
    }
  }
}

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

  // Additive backfill for modules added after roles were first seeded.
  await backfillNewModules();

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
