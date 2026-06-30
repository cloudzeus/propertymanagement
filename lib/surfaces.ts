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
  PROPERTY_ADMIN: "/manager",
  EMPLOYEE: "/staff",
  COLLABORATOR: "/marketplace",
  PROPERTY_OWNER: "/owner",
  PROPERTY_RESIDENT: "/portal",
  PROPERTY_VIEWER: "/portal",
};

export function homePathForRole(role: UserRole): string {
  return HOME_BY_ROLE[role] ?? "/";
}
