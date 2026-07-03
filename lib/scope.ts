import "server-only";
import { getEffectiveSession } from "@/lib/auth-effective";
import { COMPANY_ROLES } from "@/lib/roles-constants";

/**
 * Per-customer data isolation primitive.
 *
 * Single-tenant (one install = one management company), but WITHIN it every
 * customer's data must be isolated. Company staff (SUPER_ADMIN/ADMIN/MANAGER/
 * EMPLOYEE) operate the SaaS and see across customers; customer-side roles
 * (PROPERTY_*) are confined to their own `customerId`.
 */
export type Scope = {
  userId: string;
  role: string;
  companyId: string | null;
  customerId: string | null;
  /** Company staff — operator of the SaaS, may see every customer. */
  seesAllCustomers: boolean;
};

export async function getScope(): Promise<Scope> {
  const s = await getEffectiveSession();
  if (!s) throw new Error("Unauthorized");
  const role = s.user.role as string;
  return {
    userId: s.user.id,
    role,
    companyId: s.user.companyId,
    customerId: s.user.customerId,
    seesAllCustomers: (COMPANY_ROLES as readonly string[]).includes(role),
  };
}

/**
 * Prisma where-fragment over a `customerId` column, honoring the caller's scope.
 * Staff → {} (all customers). Customer roles → their own customer only.
 * A non-staff caller without a customerId is pinned to an impossible id (sees nothing).
 */
export function customerWhere(scope: Scope): { customerId?: string } {
  if (scope.seesAllCustomers) return {};
  return { customerId: scope.customerId ?? "__no_customer__" };
}

/** Throw unless the caller may act within `customerId` (staff, or same customer). */
export function assertCustomer(scope: Scope, customerId: string | null | undefined) {
  if (scope.seesAllCustomers) return;
  if (!customerId || scope.customerId !== customerId) {
    throw new Error("Forbidden: cross-customer access");
  }
}
