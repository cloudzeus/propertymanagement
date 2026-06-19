// Plain (non-"use server") constants — safe to import in client components.

export const USER_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "EMPLOYEE",
  "PROPERTY_ADMIN",
  "PROPERTY_OWNER",
  "PROPERTY_RESIDENT",
  "PROPERTY_VIEWER",
  "COLLABORATOR",
] as const;

export const USER_STATUSES = ["ACTIVE", "INACTIVE", "SUSPENDED"] as const;

// ── Role taxonomy (3 groups) ───────────────────────────────────────────────
// Management company (provider) side:
export const COMPANY_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE"] as const;
// Customer side (a customer / their people):
export const CUSTOMER_ROLES = ["PROPERTY_ADMIN", "PROPERTY_OWNER", "PROPERTY_RESIDENT", "PROPERTY_VIEWER"] as const;
// External collaborator / supplier (outsourcer) — assigned work/supply, can submit offers:
export const COLLABORATOR_ROLES = ["COLLABORATOR"] as const;

export const ROLE_GROUP: Record<string, "company" | "customer" | "collaborator"> = {
  SUPER_ADMIN: "company", ADMIN: "company", MANAGER: "company", EMPLOYEE: "company",
  PROPERTY_ADMIN: "customer", PROPERTY_OWNER: "customer", PROPERTY_RESIDENT: "customer", PROPERTY_VIEWER: "customer",
  COLLABORATOR: "collaborator",
};

/** Roles eligible to be linked as company employees (the Employees combo). */
export const EMPLOYEE_ROLES = ["ADMIN", "MANAGER", "EMPLOYEE"] as const;
