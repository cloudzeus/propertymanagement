"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { canManagePropertyViva } from "@/lib/property-access";
import { getPropertyPackage } from "@/lib/billing/service-amount";

/** Guard: throw unless the caller may manage this property's package/Viva.
 *  (SUPER_ADMIN/ADMIN/MANAGER, or the PROPERTY_ADMIN assigned to the property.) */
async function requirePropertyAccess(propertyId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const ok = await canManagePropertyViva(session.user.id as string, propertyId);
  if (!ok) throw new Error("Forbidden");
}

/** Revalidate the super-admin property page + every building under it. */
async function revalidateProperty(propertyId: string) {
  revalidatePath(`/super-admin/properties/${propertyId}`);
  const buildings = await db.building.findMany({ where: { propertyId }, select: { id: true } });
  for (const b of buildings) revalidatePath(`/building/${b.id}`);
}

/** Enable or disable a service on a property (the package). */
export async function setPropertyService(propertyId: string, serviceId: string, enabled: boolean) {
  await requirePropertyAccess(propertyId);
  if (enabled) {
    await db.propertyService.upsert({
      where: { propertyId_serviceId: { propertyId, serviceId } },
      create: { propertyId, serviceId, active: true, startedAt: new Date() },
      update: { active: true },
    });
  } else {
    await db.propertyService.updateMany({
      where: { propertyId, serviceId },
      data: { active: false, endedAt: new Date() },
    });
  }
  await revalidateProperty(propertyId);
  return { success: true };
}

/** Add prepaid person-minutes to a metered service (assemblies) on a property. */
export async function addPrepaidMinutes(propertyId: string, serviceId: string, minutes: number) {
  await requirePropertyAccess(propertyId);
  if (!Number.isFinite(minutes) || minutes <= 0) return { error: "Μη έγκυρα λεπτά" };
  const ps = await db.propertyService.upsert({
    where: { propertyId_serviceId: { propertyId, serviceId } },
    create: { propertyId, serviceId, active: true, startedAt: new Date(), prepaidPersonMinutes: Math.round(minutes) },
    update: { prepaidPersonMinutes: { increment: Math.round(minutes) } },
  });
  await revalidateProperty(propertyId);
  return { prepaidPersonMinutes: ps.prepaidPersonMinutes };
}

/** Current billing period, "YYYY-MM". */
function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7);
}

/** Load the property's package (server-computed amount) + the current-period
 *  ServiceInvoice status. Access-guarded. */
export async function listPropertyPackage(propertyId: string) {
  await requirePropertyAccess(propertyId);
  const property = await db.property.findUnique({ where: { id: propertyId }, select: { customerId: true } });
  if (!property) throw new Error("Property not found");

  const period = currentPeriod();
  const [pkg, invoice] = await Promise.all([
    getPropertyPackage(propertyId),
    db.serviceInvoice.findUnique({
      where: { customerId_period: { customerId: property.customerId, period } },
      select: { status: true, paidAt: true },
    }),
  ]);

  return {
    period,
    counts: pkg.counts,
    services: pkg.services,
    lines: pkg.lines,
    total: pkg.total,
    totalCents: pkg.totalCents,
    invoice: invoice ? { status: invoice.status, paidAt: invoice.paidAt } : null,
  };
}
