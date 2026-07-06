import type { Surface } from "@/lib/surfaces";
import type { UserRole } from "@/lib/prisma/enums";

export const RBAC_ACTIONS = ["view", "create", "edit", "delete"] as const;
export type RbacAction = (typeof RBAC_ACTIONS)[number];

export interface RbacModule {
  key: string;                 // stable, unique, e.g. "announcements"
  label: string;               // Greek UI label
  surface: Surface;            // company | customer | marketplace
  menu?: { href: string; icon: string; group?: string };
  actions: RbacAction[];       // which CRUD actions this module supports
}

/** Permission key format: "<moduleKey>:<action>" */
export function permKey(moduleKey: string, action: RbacAction): string {
  return `${moduleKey}:${action}`;
}

/** Default permission keys granted to each system role (baseRole). */
export type RoleDefaults = Partial<Record<UserRole, string[]>>;
