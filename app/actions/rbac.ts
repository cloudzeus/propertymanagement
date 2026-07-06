"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getEffectiveSession } from "@/lib/auth-effective";
import { surfaceForRole } from "@/lib/surfaces";
import { RBAC_MODULES } from "@/lib/rbac/registry";
import { defaultPermissionsFor } from "@/lib/rbac/permissions";
import type { UserRole } from "@/lib/prisma/enums";

async function assertSuperAdmin() {
  const eff = await getEffectiveSession();
  if (!eff || eff.real.role !== "SUPER_ADMIN") throw new Error("Forbidden");
  return eff;
}

function validKeys(): Set<string> {
  return new Set(RBAC_MODULES.flatMap((m) => m.actions.map((a) => `${m.key}:${a}`)));
}

/** Replace a role's full permission set. keys = ["module:action", ...]. */
export async function saveRolePermissions(roleId: string, keys: string[]) {
  await assertSuperAdmin();
  const role = await db.role.findUnique({ where: { id: roleId }, select: { key: true } });
  if (!role) throw new Error("Role not found");
  if (role.key === "SUPER_ADMIN") throw new Error("SUPER_ADMIN is locked to full access");

  const valid = validKeys();
  const clean = [...new Set(keys)].filter((k) => valid.has(k));
  await db.$transaction([
    db.rolePermission.deleteMany({ where: { roleId } }),
    db.rolePermission.createMany({
      data: clean.map((k) => { const [moduleKey, action] = k.split(":"); return { roleId, moduleKey, action }; }),
    }),
  ]);
  revalidatePath("/super-admin/roles");
}

export async function createCustomRole(label: string, baseRole: UserRole, keys: string[]) {
  const eff = await assertSuperAdmin();
  const key = `custom-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(36)}`;
  const valid = validKeys();
  const clean = [...new Set(keys)].filter((k) => valid.has(k));
  const role = await db.role.create({
    data: {
      key, label, baseRole, surface: surfaceForRole(baseRole), isSystem: false,
      createdById: eff.real.id,
      permissions: { create: clean.map((k) => { const [moduleKey, action] = k.split(":"); return { moduleKey, action }; }) },
    },
  });
  revalidatePath("/super-admin/roles");
  return role.id;
}

export async function deleteCustomRole(roleId: string) {
  await assertSuperAdmin();
  const role = await db.role.findUnique({ where: { id: roleId }, select: { isSystem: true, baseRole: true } });
  if (!role) throw new Error("Role not found");
  if (role.isSystem) throw new Error("System roles cannot be deleted");
  const sys = await db.role.findUnique({ where: { key: role.baseRole }, select: { id: true } });
  await db.user.updateMany({ where: { roleId }, data: { roleId: sys?.id ?? null, role: role.baseRole } });
  await db.role.delete({ where: { id: roleId } });
  revalidatePath("/super-admin/roles");
}

/** Assign a role to a user, keeping the legacy `role` enum synced to baseRole. */
export async function assignUserRole(userId: string, roleId: string) {
  await assertSuperAdmin();
  const role = await db.role.findUnique({ where: { id: roleId }, select: { baseRole: true } });
  if (!role) throw new Error("Role not found");
  await db.user.update({ where: { id: userId }, data: { roleId, role: role.baseRole } });
  revalidatePath("/super-admin/users");
}

/** Reset a system role's permissions to registry defaults. */
export async function resetRoleToDefaults(roleId: string) {
  await assertSuperAdmin();
  const role = await db.role.findUnique({ where: { id: roleId }, select: { baseRole: true, key: true } });
  if (!role) throw new Error("Role not found");
  const keys = defaultPermissionsFor(role.baseRole);
  await db.$transaction([
    db.rolePermission.deleteMany({ where: { roleId } }),
    db.rolePermission.createMany({ data: keys.map((k) => { const [moduleKey, action] = k.split(":"); return { roleId, moduleKey, action }; }) }),
  ]);
  revalidatePath("/super-admin/roles");
}
