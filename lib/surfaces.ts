import type { UserRole } from "@/lib/prisma/enums";
import { ROLE_GROUP } from "@/lib/roles-constants";

export type Surface = "company" | "customer" | "marketplace";

export const SURFACE_ROLES: Record<Surface, UserRole[]> = {
  company: ["SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE"],
  customer: ["PROPERTY_ADMIN", "PROPERTY_OWNER", "PROPERTY_RESIDENT", "PROPERTY_VIEWER"],
  marketplace: ["COLLABORATOR"],
};

export function surfaceForRole(role: UserRole): Surface {
  const group = ROLE_GROUP[role] ?? "company";
  return group === "collaborator" ? "marketplace" : group;
}

const HOME_BY_ROLE: Record<UserRole, string> = {
  SUPER_ADMIN: "/super-admin",
  ADMIN: "/admin",
  MANAGER: "/manager",
  PROPERTY_ADMIN: "/building",
  EMPLOYEE: "/staff",
  COLLABORATOR: "/marketplace",
  PROPERTY_OWNER: "/owner",
  PROPERTY_RESIDENT: "/portal",
  PROPERTY_VIEWER: "/signage",
};

export function homePathForRole(role: UserRole): string {
  return HOME_BY_ROLE[role] ?? "/";
}

/**
 * Where to redirect a request that a guard has blocked.
 * Normally /unauthorized. But when a super-admin is impersonating
 * (effectiveRole differs from their real role) we must NOT strand them on the
 * dead-end /unauthorized page (which has no "exit impersonation" control).
 * Send them to the impersonated role's home, where the Exit banner renders —
 * unless that home is the very path being blocked (avoid a redirect loop).
 */
export function deniedRedirectPath(
  realRole: string,
  effectiveRole: string,
  currentPath: string,
): string {
  if (effectiveRole !== realRole) {
    const home = homePathForRole(effectiveRole as UserRole);
    if (home !== currentPath) return home;
  }
  return "/unauthorized";
}
