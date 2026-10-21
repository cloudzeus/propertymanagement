import type { UserRole } from "@/lib/prisma/enums";
import { homePathForRole, type Surface } from "@/lib/surfaces";
import { RBAC_MODULES, DEFAULT_PERMISSIONS, MENU_GROUPS } from "./registry";
import { permKey, type RbacAction } from "./types";

export function can(perms: Set<string>, moduleKey: string, action: RbacAction): boolean {
  return perms.has(permKey(moduleKey, action));
}

export function defaultPermissionsFor(role: UserRole): string[] {
  return DEFAULT_PERMISSIONS[role] ?? [];
}

export interface MenuItem { label: string; href: string; icon: string; }
export interface MenuGroup { id: string; label: string; icon: string; color: string; defaultOpen: boolean; items: MenuItem[]; }

const FALLBACK_GROUP = { label: "", icon: "RiFileListLine", color: "#5C5C5C", defaultOpen: true };

/**
 * Sidebar menu for a surface: modules the perms allow to view, grouped and
 * ordered by MENU_GROUPS (unknown group ids go last, in first-seen order).
 */
export function buildMenu(surface: Surface, perms: Set<string>, role?: UserRole): MenuGroup[] {
  const groups = new Map<string, MenuItem[]>();
  for (const m of RBAC_MODULES) {
    if (m.surface !== surface || !m.menu) continue;
    if (!perms.has(permKey(m.key, "view"))) continue;
    const gid = m.menu.group ?? "core";
    if (!groups.has(gid)) groups.set(gid, []);
    // Both "Dashboard" modules must land each role on its own home
    // (/super-admin, /admin, /manager, /staff — /building, /owner, /portal).
    const href = (m.key === "dashboard" || m.key === "customer-dashboard") && role ? homePathForRole(role) : m.menu.href;
    groups.get(gid)!.push({ label: m.label, href, icon: m.menu.icon });
  }
  const order = (id: string) => { const i = MENU_GROUPS.findIndex((g) => g.id === id); return i === -1 ? Number.MAX_SAFE_INTEGER : i; };
  return [...groups.entries()]
    .sort((a, b) => order(a[0]) - order(b[0]))
    .map(([id, items]) => {
      const def = MENU_GROUPS.find((g) => g.id === id) ?? { ...FALLBACK_GROUP, label: id };
      return { id, label: def.label, icon: def.icon, color: def.color, defaultOpen: def.defaultOpen, items };
    });
}
