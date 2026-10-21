/** Pure scope/viewer helpers for the work center (no server imports). */
import { COMPANY_ROLES } from "@/lib/roles-constants";

export type WorkScope = { role: string; userId: string; customerIds: string[] | null };
export type WorkViewer = { id: string; role: string; canAssign: boolean; canManage: boolean; defaultMine: boolean };

const ASSIGN_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER"];

/**
 * Same rule as /admin/maintenance and the dashboard kanban: a MANAGER with
 * account-managed customers sees only those customers' buildings; everyone
 * else on the company side sees every customer.
 */
export function customerIdsForScope(role: string, managedCustomerIds: string[]): string[] | null {
  return role === "MANAGER" && managedCustomerIds.length > 0 ? managedCustomerIds : null;
}

export function viewerFor(role: string, userId: string): WorkViewer {
  const company = (COMPANY_ROLES as readonly string[]).includes(role);
  return { id: userId, role, canAssign: ASSIGN_ROLES.includes(role), canManage: company, defaultMine: role === "EMPLOYEE" };
}

/** Work-action capabilities: role tier + RBAC perms ("module:action" strings), mirroring the server guards. */
export type WorkActionViewer = WorkViewer & {
  canRfqCreate: boolean;   // company ∧ rfq:create
  canRfqEdit: boolean;     // company ∧ rfq:edit
  canForward: boolean;     // SA/ADMIN/MANAGER ∧ suppliers:edit (forwardOffer)
  canOnBehalf: boolean;    // SA/ADMIN/MANAGER — accept/confirm a work order on the customer's behalf (with a note)
  canViewFault: boolean;   // maintenance:view — may follow links to the fault page
};

export function workActionViewer(role: string, userId: string, perms: Set<string>): WorkActionViewer {
  const base = viewerFor(role, userId);
  const company = base.canManage;
  return {
    ...base,
    canRfqCreate: company && perms.has("rfq:create"),
    canRfqEdit: company && perms.has("rfq:edit"),
    canForward: base.canAssign && perms.has("suppliers:edit"),
    canOnBehalf: base.canAssign,
    canViewFault: perms.has("maintenance:view"),
  };
}
