import { db } from "@/lib/db";

const COMPANY_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER"];

export async function canManageBuildingExpenses(userId: string, buildingId: string): Promise<boolean> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!user) return false;
  if (COMPANY_ROLES.includes(user.role)) return true;
  const assignment = await db.managementAssignment.findFirst({
    where: { userId, OR: [{ buildingId }, { building: { id: buildingId } }] },
    select: { id: true },
  });
  return !!assignment;
}
