import { db } from "@/lib/db";

const STAFF = ["SUPER_ADMIN", "ADMIN"];

/** SUPER_ADMIN/ADMIN → any property; PROPERTY_ADMIN → property they're assigned to
 *  (directly or via a building under it). MANAGER (company) also → any.
 *  Owner/resident/viewer → false. */
export async function canManagePropertyViva(userId: string, propertyId: string): Promise<boolean> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!user) return false;
  if (STAFF.includes(user.role) || user.role === "MANAGER") return true;
  if (user.role !== "PROPERTY_ADMIN") return false;
  const a = await db.managementAssignment.findFirst({
    where: { userId, OR: [{ propertyId }, { building: { propertyId } }] },
    select: { id: true },
  });
  return !!a;
}
