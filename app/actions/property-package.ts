"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const user = await db.user.findUnique({ where: { id: session.user.id as string }, select: { role: true } });
  if (user?.role !== "SUPER_ADMIN") throw new Error("Forbidden");
}

/** Enable or disable a service on a property (the package). */
export async function setPropertyService(propertyId: string, serviceId: string, enabled: boolean) {
  await requireSuperAdmin();
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
  revalidatePath(`/super-admin/properties/${propertyId}`);
  return { success: true };
}

/** Add prepaid person-minutes to a metered service (assemblies) on a property. */
export async function addPrepaidMinutes(propertyId: string, serviceId: string, minutes: number) {
  await requireSuperAdmin();
  if (!Number.isFinite(minutes) || minutes <= 0) return { error: "Μη έγκυρα λεπτά" };
  const ps = await db.propertyService.upsert({
    where: { propertyId_serviceId: { propertyId, serviceId } },
    create: { propertyId, serviceId, active: true, startedAt: new Date(), prepaidPersonMinutes: Math.round(minutes) },
    update: { prepaidPersonMinutes: { increment: Math.round(minutes) } },
  });
  revalidatePath(`/super-admin/properties/${propertyId}`);
  return { prepaidPersonMinutes: ps.prepaidPersonMinutes };
}
