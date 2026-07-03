"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { getScope, assertCustomer } from "@/lib/scope";

async function requireStaff() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const user = await db.user.findUnique({ where: { id: session.user.id as string }, select: { role: true } });
  if (!["SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE", "PROPERTY_ADMIN"].includes(user?.role ?? "")) throw new Error("Forbidden");
  return user!.role as string;
}

/**
 * Authorize the caller to act on a unit and return its context.
 * Company staff may act across customers; a customer-side manager (PROPERTY_ADMIN)
 * must belong to the unit's customer AND have a ManagementAssignment covering its
 * building or property. (Data isolation — see lib/scope.ts.)
 */
async function authorizeUnit(unitId: string): Promise<Ctx> {
  const ctx = await unitContext(unitId);
  const scope = await getScope();
  if (scope.seesAllCustomers) return ctx;
  assertCustomer(scope, ctx.customerId);
  const manages = await db.managementAssignment.findFirst({
    where: { userId: scope.userId, OR: [{ buildingId: ctx.buildingId }, { propertyId: ctx.propertyId }] },
    select: { id: true },
  });
  if (!manages) throw new Error("Forbidden: not a manager of this unit");
  return ctx;
}

type Ctx = { buildingId: string; propertyId: string; companyId: string; customerId: string };
async function unitContext(unitId: string): Promise<Ctx> {
  const unit = await db.unit.findUnique({
    where: { id: unitId },
    select: { buildingId: true, building: { select: { propertyId: true, companyId: true, property: { select: { customerId: true } } } } },
  });
  if (!unit) throw new Error("Unit not found");
  return { buildingId: unit.buildingId, propertyId: unit.building.propertyId, companyId: unit.building.companyId, customerId: unit.building.property.customerId };
}

function revalidate(ctx: Ctx) {
  revalidatePath(`/super-admin/properties/${ctx.propertyId}`);
  revalidatePath(`/super-admin/buildings/${ctx.buildingId}`);
}

/** Close the currently-open occupancy (endDate = null) for a unit+role. */
async function closeOpenOccupancy(unitId: string, role: "OWNER" | "RESIDENT", endDate: Date) {
  await db.unitOccupancy.updateMany({
    where: { unitId, role: role as any, endDate: null },
    data: { endDate },
  });
}

/** Open a new occupancy record (από). */
async function openOccupancy(unitId: string, userId: string, role: "OWNER" | "RESIDENT", startDate: Date) {
  await db.unitOccupancy.create({ data: { unitId, userId, role: role as any, startDate } });
}

export type Occupant = { id: string; name: string | null; email: string };

/** Create a PROPERTY_OWNER / PROPERTY_RESIDENT user and assign to the unit. */
export async function createOccupant(
  unitId: string,
  role: "OWNER" | "RESIDENT",
  data: {
    name: string; email: string; password: string; phone?: string; mobile?: string; startDate?: string;
    // Company occupant (legal entity) — TRDR-compatible fields.
    isCompany?: boolean; afm?: string; doy?: string;
    contactName?: string; contactEmail?: string; contactPhone?: string;
  },
) {
  await requireStaff();
  const email = data.email.trim().toLowerCase();
  const s = (v?: string) => (v?.trim() || null);
  if (!data.name.trim()) return { error: data.isCompany ? "Η επωνυμία είναι υποχρεωτική" : "Το όνομα είναι υποχρεωτικό" };
  if (!email) return { error: "Το email είναι υποχρεωτικό" };
  if (data.password.length < 6) return { error: "Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες" };
  const exists = await db.user.findUnique({ where: { email } });
  if (exists) return { error: "Υπάρχει ήδη χρήστης με αυτό το email" };

  const ctx = await authorizeUnit(unitId);
  const user = await db.user.create({
    data: {
      email,
      name: data.name.trim(),
      phone: s(data.phone),
      mobile: s(data.mobile),
      role: (role === "OWNER" ? "PROPERTY_OWNER" : "PROPERTY_RESIDENT") as any,
      status: "ACTIVE" as any,
      companyId: ctx.companyId,
      customerId: ctx.customerId,
      passwordHash: await bcrypt.hash(data.password, 10),
      isCompany: !!data.isCompany,
      afm: data.isCompany ? s(data.afm) : null,
      doy: data.isCompany ? s(data.doy) : null,
      contactName: data.isCompany ? s(data.contactName) : null,
      contactEmail: data.isCompany ? s(data.contactEmail) : null,
      contactPhone: data.isCompany ? s(data.contactPhone) : null,
    },
    select: { id: true, name: true, email: true },
  });

  const start = data.startDate ? new Date(data.startDate) : new Date();
  await closeOpenOccupancy(unitId, role, start);
  await db.unit.update({ where: { id: unitId }, data: role === "OWNER" ? { ownerId: user.id } : { residentId: user.id } });
  await openOccupancy(unitId, user.id, role, start);

  revalidate(ctx);
  return { occupant: user };
}

/** Link an EXISTING user as owner/resident of the unit (no new user created). */
export async function assignOccupant(
  unitId: string,
  role: "OWNER" | "RESIDENT",
  userId: string,
  startDate?: string,
) {
  await requireStaff();
  const ctx = await authorizeUnit(unitId);
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, customerId: true } });
  if (!user) return { error: "Ο χρήστης δεν βρέθηκε" };
  // Data isolation: only a user of the unit's own customer may be linked as occupant.
  if (user.customerId !== ctx.customerId) return { error: "Ο χρήστης ανήκει σε άλλον πελάτη και δεν μπορεί να συνδεθεί" };

  const start = startDate ? new Date(startDate) : new Date();
  await closeOpenOccupancy(unitId, role, start);
  await db.unit.update({ where: { id: unitId }, data: role === "OWNER" ? { ownerId: user.id } : { residentId: user.id } });
  await openOccupancy(unitId, user.id, role, start);

  revalidate(ctx);
  return { occupant: user };
}

/** End the current owner/resident occupancy (έως) and clear the unit pointer. */
export async function clearOccupant(unitId: string, role: "OWNER" | "RESIDENT") {
  await requireStaff();
  const ctx = await authorizeUnit(unitId);
  await closeOpenOccupancy(unitId, role, new Date());
  await db.unit.update({
    where: { id: unitId },
    data: role === "OWNER" ? { ownerId: null } : { residentId: null },
  });
  revalidate(ctx);
  return { success: true };
}

/** Set/correct the occupancy date range (από/έως) for a user in a unit+role.
 *  Updates the most recent occupancy row, or creates one if none exists. */
export async function setOccupancyDates(args: {
  unitId: string; userId: string; role: "OWNER" | "RESIDENT";
  startDate: string; endDate?: string | null;
}) {
  await requireStaff();
  await authorizeUnit(args.unitId);
  const start = args.startDate ? new Date(args.startDate) : new Date();
  const end = args.endDate ? new Date(args.endDate) : null;
  if (end && end < start) return { error: "Η ημ/νία λήξης δεν μπορεί να είναι πριν την έναρξη" };

  const existing = await db.unitOccupancy.findFirst({
    where: { unitId: args.unitId, userId: args.userId, role: args.role as any },
    orderBy: { startDate: "desc" },
    select: { id: true },
  });
  if (existing) {
    await db.unitOccupancy.update({ where: { id: existing.id }, data: { startDate: start, endDate: end } });
  } else {
    await db.unitOccupancy.create({ data: { unitId: args.unitId, userId: args.userId, role: args.role as any, startDate: start, endDate: end } });
  }

  const ctx = await unitContext(args.unitId);
  revalidate(ctx);
  return { ok: true };
}

/** Update a user's contact fields (name / phone / mobile). */
export async function updateUserContact(userId: string, data: { name?: string; phone?: string; mobile?: string }) {
  await requireStaff();
  const scope = await getScope();
  if (!scope.seesAllCustomers) {
    const target = await db.user.findUnique({ where: { id: userId }, select: { customerId: true } });
    assertCustomer(scope, target?.customerId);
  }
  await db.user.update({
    where: { id: userId },
    data: {
      ...(data.name !== undefined ? { name: data.name.trim() || null } : {}),
      ...(data.phone !== undefined ? { phone: data.phone.trim() || null } : {}),
      ...(data.mobile !== undefined ? { mobile: data.mobile.trim() || null } : {}),
    },
  });
  return { ok: true };
}
