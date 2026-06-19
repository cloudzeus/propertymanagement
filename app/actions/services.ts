"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const user = await db.user.findUnique({
    where: { id: session.user.id as string },
    select: { role: true },
  });
  if (user?.role !== "SUPER_ADMIN") throw new Error("Forbidden");
}

/** The managing (provider) company — single tenant. */
async function managingCompanyId(): Promise<string> {
  const c = await db.company.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
  if (!c) throw new Error("No managing company");
  return c.id;
}

type ServiceInput = {
  name: string;
  code: string;
  description?: string | null;
  isCore: boolean;
  pricingModel: "PER_UNIT" | "PER_BUILDING" | "PER_COMMON_AREA" | "FLAT" | "METERED_PREPAID";
  price: number;
  active: boolean;
};

export async function createService(data: ServiceInput) {
  await requireSuperAdmin();
  const code = data.code.trim();
  if (!data.name.trim()) return { error: "Το όνομα είναι υποχρεωτικό" };
  if (!code) return { error: "Ο κωδικός είναι υποχρεωτικός" };
  const existing = await db.service.findUnique({ where: { code } });
  if (existing) return { error: "Υπάρχει ήδη υπηρεσία με αυτόν τον κωδικό" };

  const service = await db.service.create({
    data: {
      companyId: await managingCompanyId(),
      name: data.name.trim(),
      code,
      description: data.description?.trim() || null,
      isCore: data.isCore,
      pricingModel: data.pricingModel as any,
      price: data.price,
      active: data.active,
    },
  });
  revalidatePath("/super-admin/services");
  return { service: serialize(service) };
}

export async function updateService(id: string, data: Partial<ServiceInput>) {
  await requireSuperAdmin();
  if (data.code !== undefined) {
    const code = data.code.trim();
    const clash = await db.service.findFirst({ where: { code, NOT: { id } } });
    if (clash) return { error: "Υπάρχει ήδη υπηρεσία με αυτόν τον κωδικό" };
  }
  const service = await db.service.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.code !== undefined ? { code: data.code.trim() } : {}),
      ...(data.description !== undefined ? { description: data.description?.trim() || null } : {}),
      ...(data.isCore !== undefined ? { isCore: data.isCore } : {}),
      ...(data.pricingModel !== undefined ? { pricingModel: data.pricingModel as any } : {}),
      ...(data.price !== undefined ? { price: data.price } : {}),
      ...(data.active !== undefined ? { active: data.active } : {}),
    },
  });
  revalidatePath("/super-admin/services");
  return { service: serialize(service) };
}

export async function deleteService(id: string) {
  await requireSuperAdmin();
  const inUse = await db.propertyService.count({ where: { serviceId: id } });
  if (inUse > 0) return { error: "Η υπηρεσία χρησιμοποιείται σε ιδιοκτησίες — απενεργοποιήστε την αντί να τη διαγράψετε" };
  await db.service.delete({ where: { id } });
  revalidatePath("/super-admin/services");
  return { success: true };
}

// Decimal → number for client serialization
function serialize<T extends { price: unknown }>(s: T) {
  return { ...s, price: Number(s.price) };
}
