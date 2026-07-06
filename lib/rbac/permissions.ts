import type { UserRole } from "@/lib/prisma/enums";
import type { Surface } from "@/lib/surfaces";
import { permKey, type RbacAction } from "./types";
import { can, defaultPermissionsFor } from "./permissions-core";

export { can, defaultPermissionsFor, buildMenu } from "./permissions-core";
export type { MenuItem, MenuGroup } from "./permissions-core";

/**
 * Resolve the effective session's allowed permission keys.
 *
 * NOTE: `next/navigation`, `@/lib/db`, and `@/lib/auth-effective` are imported
 * dynamically (not at module top-level) so that `lib/rbac/permissions-core.ts`'s
 * pure functions (re-exported here) remain importable from Vitest, whose node
 * environment cannot resolve next-auth's `next/server` subpath export.
 */
export async function getEffectivePermissions(): Promise<{
  perms: Set<string>; surface: Surface; roleId: string | null; role: UserRole;
} | null> {
  const { getEffectiveSession } = await import("@/lib/auth-effective");
  const { db } = await import("@/lib/db");
  const { surfaceForRole } = await import("@/lib/surfaces");

  const eff = await getEffectiveSession();
  if (!eff) return null;
  const role = eff.user.role;
  const surface = surfaceForRole(role);

  const roleId = (eff.user as { roleId?: string | null }).roleId ?? null;
  if (roleId) {
    const rows = await db.rolePermission.findMany({ where: { roleId }, select: { moduleKey: true, action: true } });
    return { perms: new Set(rows.map((r) => permKey(r.moduleKey, r.action as RbacAction))), surface, roleId, role };
  }
  const sysRole = await db.role.findUnique({ where: { key: role }, select: { id: true } });
  if (sysRole) {
    const rows = await db.rolePermission.findMany({ where: { roleId: sysRole.id }, select: { moduleKey: true, action: true } });
    return { perms: new Set(rows.map((r) => permKey(r.moduleKey, r.action as RbacAction))), surface, roleId: sysRole.id, role };
  }
  return { perms: new Set(defaultPermissionsFor(role)), surface, roleId: null, role };
}

/** Server guard: redirect if the current user lacks the permission. */
export async function requirePermission(moduleKey: string, action: RbacAction): Promise<void> {
  const { redirect } = await import("next/navigation");
  const resolved = await getEffectivePermissions();
  if (!resolved) {
    redirect("/login");
    return;
  }
  if (!can(resolved.perms, moduleKey, action)) redirect("/unauthorized");
}
