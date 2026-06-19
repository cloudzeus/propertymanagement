"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { geocodeAddress } from "@/lib/geocoding";
import { revalidatePath } from "next/cache";

export async function geocodeProperty(propertyId: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const property = await db.building.findUnique({
    where: { id: propertyId },
    select: { id: true, address: true, city: true, postalCode: true, country: true },
  });
  if (!property) return { error: "Property not found" };

  const query = `${property.address}, ${property.city}, ${property.postalCode}, ${property.country}`;
  const results = await geocodeAddress(query);
  if (!results.length) return { error: "No geocoding results found" };

  const { lat, lng } = results[0];
  await db.building.update({
    where: { id: propertyId },
    data: { lat, lng },
  });

  revalidatePath("/admin/properties");
  revalidatePath(`/admin/properties/${propertyId}`);
  revalidatePath("/manager/properties");
  revalidatePath(`/manager/properties/${propertyId}`);

  return { lat, lng };
}

export async function updatePropertyGeodata(
  propertyId: string,
  lat: number,
  lng: number
) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  await db.building.update({
    where: { id: propertyId },
    data: { lat, lng },
  });

  revalidatePath("/admin/properties");
  revalidatePath(`/admin/properties/${propertyId}`);
  revalidatePath("/manager/properties");
  revalidatePath(`/manager/properties/${propertyId}`);

  return { success: true };
}
