"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

async function requireStaff() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const user = await db.user.findUnique({ where: { id: session.user.id as string }, select: { role: true } });
  if (!["SUPER_ADMIN", "ADMIN", "MANAGER", "PROPERTY_ADMIN"].includes(user?.role ?? "")) throw new Error("Forbidden");
  return user!.role as string;
}

export type ManagerScope = { propertyId: string } | { buildingId: string };
export type ManagerRow = { assignmentId: string; id: string; name: string | null; email: string; role: string };
export type ManagerCandidate = { id: string; name: string | null; email: string; role: string; origin: "occupant" | "staff" };

/** Resolve a scope to its propertyId + companyId (for staff filtering / revalidate). */
async function resolveScope(scope: ManagerScope): Promise<{ propertyId: string; companyId: string }> {
  if ("buildingId" in scope) {
    const b = await db.building.findUnique({ where: { id: scope.buildingId }, select: { propertyId: true, companyId: true } });
    if (!b) throw new Error("Building not found");
    return { propertyId: b.propertyId, companyId: b.companyId };
  }
  const p = await db.property.findUnique({ where: { id: scope.propertyId }, select: { id: true, companyId: true } });
  if (!p) throw new Error("Property not found");
  return { propertyId: p.id, companyId: p.companyId };
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
  const { companyId } = await resolveScope(scope);
  const occupantIds = await occupantIdsForScope(scope);
  const q = query.trim();
  const text = q
    ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { email: { contains: q, mode: "insensitive" as const } }] }
    : {};

  const users = await db.user.findMany({
    where: {
      AND: [
        text,
        {
          OR: [
            { id: { in: [...occupantIds] } },
            { companyId, role: { in: ["ADMIN", "MANAGER", "EMPLOYEE"] as any } },
          ],
        },
      ],
    },
    select: { id: true, name: true, email: true, role: true },
    orderBy: [{ name: "asc" }, { email: "asc" }],
    take: 25,
  });

  return users.map((u) => ({ ...u, origin: occupantIds.has(u.id) ? "occupant" : "staff" }));
}

/** Assign a candidate as manager (PROPERTY_ADMIN) of the scope. */
export async function addManager(scope: ManagerScope, userId: string) {
  await requireStaff();
  const { propertyId } = await resolveScope(scope);

  // Only allow candidates from the scope's pool (occupant or company staff).
  const candidates = await searchManagerCandidates(scope, "");
  if (!candidates.some((c) => c.id === userId)) {
    // Fall back to a direct membership check (covers names that wouldn't match an empty query take-limit).
    const occupantIds = await occupantIdsForScope(scope);
    const { companyId } = await resolveScope(scope);
    const staff = await db.user.findFirst({ where: { id: userId, companyId, role: { in: ["ADMIN", "MANAGER", "EMPLOYEE"] as any } }, select: { id: true } });
    if (!occupantIds.has(userId) && !staff) return { error: "Ο χρήστης δεν είναι επιλέξιμος για διαχειριστής αυτού του χώρου" };
  }

  await db.managementAssignment.upsert({
    where: {
      userId_propertyId_buildingId: {
        userId,
        propertyId: "propertyId" in scope ? scope.propertyId : (null as any),
        buildingId: "buildingId" in scope ? scope.buildingId : (null as any),
      },
    },
    create: {
      userId,
      propertyId: "propertyId" in scope ? scope.propertyId : null,
      buildingId: "buildingId" in scope ? scope.buildingId : null,
      role: "PROPERTY_ADMIN",
    },
    update: {},
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
    select: { propertyId: true, building: { select: { propertyId: true } } },
  });
  await db.managementAssignment.delete({ where: { id: assignmentId } });
  const propertyId = a?.propertyId ?? a?.building?.propertyId;
  if (propertyId) revalidatePath(`/super-admin/properties/${propertyId}`);
  revalidatePath(`/super-admin/properties`);
  return { ok: true };
}
