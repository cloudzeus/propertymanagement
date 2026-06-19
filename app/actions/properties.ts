"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { ensureFolder, propertyFolder, buildingFolder } from "@/lib/bunnycdn";

async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const user = await db.user.findUnique({
    where: { id: session.user.id as string },
    select: { role: true },
  });
  if (user?.role !== "SUPER_ADMIN") throw new Error("Forbidden");
}

async function managingCompanyId(): Promise<string> {
  const c = await db.company.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
  if (!c) throw new Error("No managing company");
  return c.id;
}

export type PropertyInput = {
  customerId: string;
  name: string;
  notes?: string | null;
  address?: string | null;
  city?: string | null;
  postalCode?: string | null;
  country?: string | null;
  lat?: number | null;
  lng?: number | null;
  vivaEnabled?: boolean;
  vivaMerchantId?: string | null;
  vivaSourceCode?: string | null;
  // On create: the default building shares the property's address (default true)
  sameAddressBuilding?: boolean;
  buildingName?: string | null;
};

function extraData(d: Partial<PropertyInput>) {
  const s = (v?: string | null) => (v?.trim() || null);
  return {
    ...(d.address !== undefined ? { address: s(d.address) } : {}),
    ...(d.city !== undefined ? { city: s(d.city) } : {}),
    ...(d.postalCode !== undefined ? { postalCode: s(d.postalCode) } : {}),
    ...(d.country !== undefined ? { country: s(d.country) } : {}),
    ...(d.lat !== undefined ? { lat: d.lat } : {}),
    ...(d.lng !== undefined ? { lng: d.lng } : {}),
    ...(d.vivaEnabled !== undefined ? { vivaEnabled: d.vivaEnabled } : {}),
    ...(d.vivaMerchantId !== undefined ? { vivaMerchantId: s(d.vivaMerchantId) } : {}),
    ...(d.vivaSourceCode !== undefined ? { vivaSourceCode: s(d.vivaSourceCode) } : {}),
  };
}

export async function createProperty(data: PropertyInput) {
  await requireSuperAdmin();
  if (!data.customerId) return { error: "Επιλέξτε πελάτη" };
  if (!data.name.trim()) return { error: "Το όνομα είναι υποχρεωτικό" };
  const companyId = await managingCompanyId();
  const property = await db.property.create({
    data: {
      companyId,
      customerId: data.customerId,
      name: data.name.trim(),
      notes: data.notes?.trim() || null,
      ...extraData(data),
    },
    include: { customer: { select: { name: true } } },
  });

  // Every property starts with at least one default building.
  const sameAddress = data.sameAddressBuilding ?? true;
  const building = await db.building.create({
    data: {
      companyId,
      propertyId: property.id,
      name: data.buildingName?.trim() || property.name,
      address: sameAddress ? (property.address ?? "") : "",
      city: sameAddress ? (property.city ?? "") : "",
      postalCode: sameAddress ? (property.postalCode ?? "") : "",
      country: sameAddress ? (property.country ?? "Greece") : "Greece",
      lat: sameAddress ? property.lat : null,
      lng: sameAddress ? property.lng : null,
    },
  });

  // Best-effort BunnyCDN folder setup (don't fail creation if storage is down).
  try {
    await ensureFolder(propertyFolder(property.id));
    await ensureFolder(buildingFolder(property.id, building.id));
  } catch (e) {
    console.error("BunnyCDN folder creation failed for property", property.id, e);
  }

  revalidatePath("/super-admin/properties");
  return {
    property: {
      id: property.id, name: property.name, notes: property.notes,
      customerId: property.customerId, customerName: property.customer.name,
      address: property.address, city: property.city, postalCode: property.postalCode, country: property.country,
      lat: property.lat, lng: property.lng,
      vivaEnabled: property.vivaEnabled, vivaMerchantId: property.vivaMerchantId, vivaSourceCode: property.vivaSourceCode,
      buildingCount: 1, unitCount: 0, serviceCount: 0,
    },
  };
}

export async function updateProperty(id: string, data: Partial<PropertyInput>) {
  await requireSuperAdmin();
  const property = await db.property.update({
    where: { id },
    data: {
      ...(data.customerId ? { customerId: data.customerId } : {}),
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.notes !== undefined ? { notes: data.notes?.trim() || null } : {}),
      ...extraData(data),
    },
    include: {
      customer: { select: { name: true } },
      _count: { select: { buildings: true, services: true } },
    },
  });
  const unitCount = await db.unit.count({ where: { building: { propertyId: id } } });
  revalidatePath("/super-admin/properties");
  return {
    property: {
      id: property.id, name: property.name, notes: property.notes,
      customerId: property.customerId, customerName: property.customer.name,
      address: property.address, city: property.city, postalCode: property.postalCode, country: property.country,
      lat: property.lat, lng: property.lng,
      vivaEnabled: property.vivaEnabled, vivaMerchantId: property.vivaMerchantId, vivaSourceCode: property.vivaSourceCode,
      buildingCount: property._count.buildings, unitCount, serviceCount: property._count.services,
    },
  };
}

export async function deleteProperty(id: string) {
  await requireSuperAdmin();
  const buildings = await db.building.count({ where: { propertyId: id } });
  if (buildings > 0) return { error: "Η ιδιοκτησία έχει κτήρια — διαγράψτε τα πρώτα" };
  await db.property.delete({ where: { id } });
  revalidatePath("/super-admin/properties");
  return { success: true };
}
