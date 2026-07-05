export type ScopeLike = { seesAllCustomers: boolean; customerId: string | null };

export type ResolveResult =
  | { ok: true; customerId: string | null }
  | { ok: false; reason: "no-targets" | "cross-customer" };

/** Decide an announcement's owning customerId from its targets' customerIds.
 *  Staff may span customers (→ null broadcast). A customer-side caller must own
 *  every target, else cross-customer is rejected. */
export function resolveAnnouncementCustomer(scope: ScopeLike, targetCustomerIds: string[]): ResolveResult {
  if (targetCustomerIds.length === 0) return { ok: false, reason: "no-targets" };
  const distinct = [...new Set(targetCustomerIds)];

  if (!scope.seesAllCustomers) {
    const foreign = distinct.some((c) => c !== scope.customerId);
    if (foreign || scope.customerId == null) return { ok: false, reason: "cross-customer" };
    return { ok: true, customerId: scope.customerId };
  }

  return { ok: true, customerId: distinct.length === 1 ? distinct[0] : null };
}
