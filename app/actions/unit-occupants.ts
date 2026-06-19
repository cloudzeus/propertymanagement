"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";

async function requireStaff() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const user = await db.user.findUnique({ where: { id: session.user.id as string }, select: { role: true } });
  // Super-admin / admin (provider) or a property admin (customer) may manage occupants
  if (!["SUPER_ADMIN", "ADMIN", "MANAGER", "PROPERTY_ADMIN"].includes(user?.role ?? "")) throw new Error("Forbidden");
  return user!.role as string;
}

type Ctx = { propertyId: string; companyId: string; customerId: string };
async function unitContext(unitId: string): Promise<Ctx> {
  const unit = await db.unit.findUnique({
    where: { id: unitId },
    select: { building: { select: { propertyId: true, companyId: true, property: { select: { customerId: true } } } } },
  });
  if (!unit) throw new Error("Unit not found");
  return { propertyId: unit.building.propertyId, companyId: unit.building.companyId, customerId: unit.building.property.customerId };
}

export type Occupant = { id: string; name: string | null; email: string };

/** Create a PROPERTY_OWNER / PROPERTY_RESIDENT user and assign to the unit. */
export async function createOccupant(
  unitId: string,
  role: "OWNER" | "RESIDENT",
  data: { name: string; email: string; password: string },
) {
  await requireStaff();
  const email = data.email.trim().toLowerCase();
  if (!data.name.trim()) return { error: "Το όνομα είναι υποχρεωτικό" };
  if (!email) return { error: "Το email είναι υποχρεωτικό" };
  if (data.password.length < 6) return { error: "Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες" };
  const exists = await db.user.findUnique({ where: { email } });
  if (exists) return { error: "Υπάρχει ήδη χρήστης με αυτό το email" };

  const ctx = await unitContext(unitId);
  const user = await db.user.create({
    data: {
      email,
      name: data.name.trim(),
      role: (role === "OWNER" ? "PROPERTY_OWNER" : "PROPERTY_RESIDENT") as any,
      status: "ACTIVE" as any,
      companyId: ctx.companyId,
      customerId: ctx.customerId,
      passwordHash: await bcrypt.hash(data.password, 10),
    },
    select: { id: true, name: true, email: true },
  });

  await db.unit.update({
    where: { id: unitId },
    data: role === "OWNER" ? { ownerId: user.id } : { residentId: user.id },
  });

  revalidatePath(`/super-admin/properties/${ctx.propertyId}`);
  return { occupant: user };
}

/** Link an EXISTING user as owner/resident of the unit (no new user created).
 *  Lets one person be owner/resident across many units. */
export async function assignOccupant(
  unitId: string,
  role: "OWNER" | "RESIDENT",
  userId: string,
) {
  await requireStaff();
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true } });
  if (!user) return { error: "Ο χρήστης δεν βρέθηκε" };

  const ctx = await unitContext(unitId);
  await db.unit.update({
    where: { id: unitId },
    data: role === "OWNER" ? { ownerId: user.id } : { residentId: user.id },
  });

  revalidatePath(`/super-admin/properties/${ctx.propertyId}`);
  return { occupant: user };
}

/** Remove the owner/resident link from a unit (does not delete the user). */
export async function clearOccupant(unitId: string, role: "OWNER" | "RESIDENT") {
  await requireStaff();
  const ctx = await unitContext(unitId);
  await db.unit.update({
    where: { id: unitId },
    data: role === "OWNER" ? { ownerId: null } : { residentId: null },
  });
  revalidatePath(`/super-admin/properties/${ctx.propertyId}`);
  return { success: true };
}
