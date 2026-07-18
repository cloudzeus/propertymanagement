import type { UserRole } from "@/lib/prisma/enums";

/**
 * Customer-surface role hierarchy.
 *
 * Product principle: one User per email; the same person can simultaneously be
 * manager/owner/resident across properties. `User.role` stores their HIGHEST
 * customer role (login lands on that role's dashboard via homePathForRole, and
 * higher roles may access lower-role surfaces). Assignments may only ever RAISE
 * a customer role — never lower it, and never touch staff/collaborator roles.
 */

/** Customer-surface hierarchy, highest first. Staff/collaborator roles are outside it. */
export const CUSTOMER_ROLE_RANK: Record<string, number> = {
  PROPERTY_ADMIN: 3,
  PROPERTY_OWNER: 2,
  PROPERTY_RESIDENT: 1,
  PROPERTY_VIEWER: 0,
};

export function isCustomerRole(role: string): boolean {
  return role in CUSTOMER_ROLE_RANK;
}

/** The role a user should hold after gaining `candidate`: upgrades within the
 *  customer hierarchy only — staff/collaborator roles and downgrades are never changed. */
export function roleAfterGaining(current: UserRole, candidate: UserRole): UserRole {
  if (!isCustomerRole(current) || !isCustomerRole(candidate)) return current;
  return CUSTOMER_ROLE_RANK[candidate] > CUSTOMER_ROLE_RANK[current] ? candidate : current;
}
