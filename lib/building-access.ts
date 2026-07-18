import { auth } from "@/auth";
import { db } from "@/lib/db";
import { type BuildingCaps, capsForStaff, capsForManager } from "@/lib/building-caps";

export type BuildingAccess = {
  viewer: "staff" | "manager";
  managed: boolean;
  can: BuildingCaps;
};

const STAFF_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER"] as const;

/** Resolve what `userId` may do on `buildingId`. Null → no access (render 404). */
export async function getBuildingAccess(userId: string, buildingId: string): Promise<BuildingAccess | null> {
  const [user, building] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { role: true } }),
    db.building.findUnique({
      where: { id: buildingId },
      select: { propertyId: true, property: { select: { managed: true } } },
    }),
  ]);
  if (!user || !building) return null;
  const managed = building.property.managed;

  if ((STAFF_ROLES as readonly string[]).includes(user.role)) {
    return { viewer: "staff", managed, can: capsForStaff() };
  }
  if (user.role !== "PROPERTY_ADMIN") return null;

  const assignment = await db.managementAssignment.findFirst({
    where: { userId, OR: [{ buildingId }, { propertyId: building.propertyId }] },
    select: { id: true },
  });
  if (!assignment) return null;
  return { viewer: "manager", managed, can: capsForManager(managed) };
}

/** Guard for server actions: throws unless the session user holds `cap` on the building. */
export async function requireBuildingCap(buildingId: string, cap: keyof BuildingCaps): Promise<{ userId: string; access: BuildingAccess }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const access = await getBuildingAccess(session.user.id as string, buildingId);
  if (!access || !access.can[cap]) throw new Error("Forbidden");
  return { userId: session.user.id as string, access };
}

/** All building IDs a PROPERTY_ADMIN reaches via ManagementAssignment (direct or property-wide). */
export async function managerBuildingIds(userId: string): Promise<string[]> {
  const assignments = await db.managementAssignment.findMany({
    where: { userId },
    select: { buildingId: true, propertyId: true },
  });
  const direct = assignments.map((a) => a.buildingId).filter((x): x is string => !!x);
  const propertyIds = assignments.map((a) => a.propertyId).filter((x): x is string => !!x);
  const viaProperty = propertyIds.length
    ? (await db.building.findMany({ where: { propertyId: { in: propertyIds } }, select: { id: true } })).map((b) => b.id)
    : [];
  return Array.from(new Set([...direct, ...viaProperty]));
}
