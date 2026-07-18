import type { UserRole } from "@/lib/prisma/enums";
import { homePathForRole, type Surface } from "@/lib/surfaces";
import { RBAC_MODULES, DEFAULT_PERMISSIONS } from "./registry";
import { permKey, type RbacAction } from "./types";

export function can(perms: Set<string>, moduleKey: string, action: RbacAction): boolean {
  return perms.has(permKey(moduleKey, action));
}

export function defaultPermissionsFor(role: UserRole): string[] {
  return DEFAULT_PERMISSIONS[role] ?? [];
}

export interface MenuItem { label: string; href: string; icon: string; }
export interface MenuGroup { id: string; items: MenuItem[]; }

export function buildMenu(surface: Surface, perms: Set<string>, role?: UserRole): MenuGroup[] {
  const groups = new Map<string, MenuItem[]>();
  for (const m of RBAC_MODULES) {
    if (m.surface !== surface || !m.menu) continue;
    if (!perms.has(permKey(m.key, "view"))) continue;
    const gid = m.menu.group ?? "core";
    if (!groups.has(gid)) groups.set(gid, []);
    // The customer surface hosts several role homes (/building, /owner, /portal):
    // the shared Dashboard entry must land each role on its own home.
    const href = m.key === "customer-dashboard" && role ? homePathForRole(role) : m.menu.href;
    groups.get(gid)!.push({ label: m.label, href, icon: m.menu.icon });
  }
  return [...groups.entries()].map(([id, items]) => ({ id, items }));
}
