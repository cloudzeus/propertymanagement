import { db } from "@/lib/db";

export interface CustomerRef {
  customerId?: string;
  buildingId?: string;
}

/** Resolve the owning Customer for a metered event. Never crosses customers — returns null if unresolved. */
export async function resolveCustomerId(ref: CustomerRef): Promise<string | null> {
  if (ref.customerId) return ref.customerId;
  if (ref.buildingId) {
    const b = await db.building.findUnique({
      where: { id: ref.buildingId },
      include: { property: { select: { customerId: true } } },
    });
    return b?.property?.customerId ?? null;
  }
  return null;
}
