"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { getScope } from "@/lib/scope";
import { requireBuildingCap } from "@/lib/building-access";
import { roleAfterGaining } from "@/lib/customer-role-hierarchy";
import type { UserRole } from "@/lib/prisma/enums";

async function requireStaff() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const user = await db.user.findUnique({ where: { id: session.user.id as string }, select: { role: true } });
  if (!["SUPER_ADMIN", "ADMIN", "MANAGER", "PROPERTY_ADMIN"].includes(user?.role ?? "")) throw new Error("Forbidden");
  return user!.role as string;
}

/** Authorize the caller for a manager scope. Manager CRUD is company-staff-only:
 *  building scopes route through the `manageManagers` capability (which only
 *  staff ever hold), and property scopes require the staff role explicitly —
 *  PROPERTY_ADMIN is always denied. */
async function authorizeScope(scope: ManagerScope) {
  if ("buildingId" in scope) await requireBuildingCap(scope.buildingId, "manageManagers");
  const resolved = await resolveScope(scope);
  const s = await getScope();
  if (!s.seesAllCustomers) throw new Error("Forbidden");
  return resolved;
}

export type ManagerScope = { propertyId: string } | { buildingId: string };
export type ManagerRow = { assignmentId: string; id: string; name: string | null; email: string; role: string };
export type ManagerCandidate = { id: string; name: string | null; email: string; role: string; origin: "occupant" | "staff" | "customer" };

/** Resolve a scope to its propertyId + companyId + customerId + managed flag. */
async function resolveScope(scope: ManagerScope): Promise<{ propertyId: string; companyId: string; customerId: string; managed: boolean }> {
  if ("buildingId" in scope) {
    const b = await db.building.findUnique({ where: { id: scope.buildingId }, select: { propertyId: true, companyId: true, property: { select: { customerId: true, managed: true } } } });
    if (!b) throw new Error("Building not found");
    return { propertyId: b.propertyId, companyId: b.companyId, customerId: b.property.customerId, managed: b.property.managed };
  }
  const p = await db.property.findUnique({ where: { id: scope.propertyId }, select: { id: true, companyId: true, customerId: true, managed: true } });
  if (!p) throw new Error("Property not found");
  return { propertyId: p.id, companyId: p.companyId, customerId: p.customerId, managed: p.managed };
}

/** Whether the scope's property is company-managed (affects the manager candidate pool). */
export async function getManagerScopeInfo(scope: ManagerScope): Promise<{ managed: boolean }> {
  await requireStaff();
  const { managed } = await authorizeScope(scope);
  return { managed };
}

/** Owner/resident user ids within a scope (building → its units; property → all its buildings' units). */
async function occupantIdsForScope(scope: ManagerScope): Promise<Set<string>> {
  const where = "buildingId" in scope ? { buildingId: scope.buildingId } : { building: { propertyId: scope.propertyId } };
  const units = await db.unit.findMany({ where, select: { ownerId: true, residentId: true } });
  const ids = new Set<string>();
  for (const u of units) { if (u.ownerId) ids.add(u.ownerId); if (u.residentId) ids.add(u.residentId); }
  return ids;
}

/** Current managers assigned to a scope. */
export async function listManagers(scope: ManagerScope): Promise<ManagerRow[]> {
  await requireStaff();
  await authorizeScope(scope);
  const rows = await db.managementAssignment.findMany({
    where: "buildingId" in scope ? { buildingId: scope.buildingId } : { propertyId: scope.propertyId },
    select: { id: true, user: { select: { id: true, name: true, email: true, role: true } } },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => ({ assignmentId: r.id, id: r.user.id, name: r.user.name, email: r.user.email, role: r.user.role }));
}

/** Candidate users for a scope: its owners/residents + company staff (ADMIN/MANAGER/EMPLOYEE). */
export async function searchManagerCandidates(scope: ManagerScope, query: string): Promise<ManagerCandidate[]> {
  await requireStaff();
  const { companyId, customerId, managed } = await authorizeScope(scope);
  const occupantIds = await occupantIdsForScope(scope);
  const q = query.trim();
  const text = q
    ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { email: { contains: q, mode: "insensitive" as const } }] }
    : {};

  // Owners/residents + the customer are always eligible. A company-managed property
  // ALSO offers company staff (ADMIN/MANAGER/EMPLOYEE) as candidates.
  const pool: any[] = [{ id: { in: [...occupantIds] } }, { customerId }];
  if (managed) pool.push({ companyId, role: { in: ["ADMIN", "MANAGER", "EMPLOYEE"] as any } });

  const users = await db.user.findMany({
    where: { AND: [text, { OR: pool }] },
    select: { id: true, name: true, email: true, role: true, customerId: true },
    orderBy: [{ name: "asc" }, { email: "asc" }],
    take: 50,
  });

  return users.map(({ customerId: uCustomerId, ...u }) => ({
    ...u,
    origin: occupantIds.has(u.id) ? "occupant" : uCustomerId === customerId ? "customer" : "staff",
  }));
}

/** Assign a candidate as manager (PROPERTY_ADMIN) of the scope. */
export async function addManager(scope: ManagerScope, userId: string) {
  await requireStaff();
  const { propertyId } = await authorizeScope(scope);

  // Eligible: an owner/resident of the scope, the customer's own user, or — for a
  // company-managed property — a company staff member.
  const candidates = await searchManagerCandidates(scope, "");
  if (!candidates.some((c) => c.id === userId)) {
    // Fall back to a direct membership check (covers names beyond the empty-query take-limit).
    const { companyId, customerId, managed } = await resolveScope(scope);
    const occupantIds = await occupantIdsForScope(scope);
    let eligible: { id: string } | null = occupantIds.has(userId) ? { id: userId } : null;
    if (!eligible) eligible = await db.user.findFirst({ where: { id: userId, customerId }, select: { id: true } });
    if (!eligible && managed) eligible = await db.user.findFirst({ where: { id: userId, companyId, role: { in: ["ADMIN", "MANAGER", "EMPLOYEE"] as any } }, select: { id: true } });
    if (!eligible) return { error: "Ο χρήστης δεν είναι επιλέξιμος για διαχειριστής αυτού του χώρου" };
  }

  // The compound unique (userId_propertyId_buildingId) contains a nullable column,
  // which Prisma cannot match in an upsert `where`. Use find-then-create instead.
  const targetPropertyId = "propertyId" in scope ? scope.propertyId : null;
  const targetBuildingId = "buildingId" in scope ? scope.buildingId : null;
  const existing = await db.managementAssignment.findFirst({
    where: { userId, propertyId: targetPropertyId, buildingId: targetBuildingId },
    select: { id: true },
  });
  if (!existing) {
    await db.managementAssignment.create({
      data: { userId, propertyId: targetPropertyId, buildingId: targetBuildingId, role: "PROPERTY_ADMIN" },
    });
  }

  // Customer-role hierarchy: becoming a manager may only ever RAISE the user's
  // customer role to PROPERTY_ADMIN; staff/collaborator roles are never changed.
  const target = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (target) {
    const upgraded = roleAfterGaining(target.role as UserRole, "PROPERTY_ADMIN");
    if (upgraded !== target.role) {
      await db.user.update({ where: { id: userId }, data: { role: upgraded as any } });
    }
  }

  revalidatePath(`/super-admin/properties/${propertyId}`);
  revalidatePath(`/super-admin/properties`);
  return { ok: true };
}

/** Create a brand-new PROPERTY_ADMIN user and assign them as manager of the scope. */
export async function createAndAddManager(
  scope: ManagerScope,
  data: { name: string; email: string; password: string; phone?: string; mobile?: string },
) {
  await requireStaff();
  const { propertyId, companyId, customerId } = await authorizeScope(scope);

  const email = data.email.trim().toLowerCase();
  if (!data.name.trim()) return { error: "Το όνομα είναι υποχρεωτικό" };
  if (!email) return { error: "Το email είναι υποχρεωτικό" };
  if (data.password.length < 6) return { error: "Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες" };
  const exists = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (exists) return { error: "Υπάρχει ήδη χρήστης με αυτό το email" };

  const user = await db.user.create({
    data: {
      email,
      name: data.name.trim(),
      phone: data.phone?.trim() || null,
      mobile: data.mobile?.trim() || null,
      role: "PROPERTY_ADMIN" as any,
      status: "ACTIVE" as any,
      companyId,
      customerId,
      passwordHash: await bcrypt.hash(data.password, 10),
    },
    select: { id: true },
  });

  const targetPropertyId = "propertyId" in scope ? scope.propertyId : null;
  const targetBuildingId = "buildingId" in scope ? scope.buildingId : null;
  await db.managementAssignment.create({
    data: { userId: user.id, propertyId: targetPropertyId, buildingId: targetBuildingId, role: "PROPERTY_ADMIN" },
  });

  revalidatePath(`/super-admin/properties/${propertyId}`);
  revalidatePath(`/super-admin/properties`);
  return { ok: true };
}

/** Remove a manager assignment. */
export async function removeManager(assignmentId: string) {
  await requireStaff();
  const a = await db.managementAssignment.findUnique({
    where: { id: assignmentId },
    select: { propertyId: true, buildingId: true, building: { select: { propertyId: true } } },
  });
  if (!a) return { ok: true };
  // Authorize against the assignment's scope before deleting.
  await authorizeScope(a.buildingId ? { buildingId: a.buildingId } : { propertyId: a.propertyId! });
  await db.managementAssignment.delete({ where: { id: assignmentId } });
  const propertyId = a?.propertyId ?? a?.building?.propertyId;
  if (propertyId) revalidatePath(`/super-admin/properties/${propertyId}`);
  revalidatePath(`/super-admin/properties`);
  return { ok: true };
}
