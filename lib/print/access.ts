import "server-only";
import { getEffectiveSession } from "@/lib/auth-effective";
import { getBuildingAccess, managerBuildingIds } from "@/lib/building-access";
import { db } from "@/lib/db";

export const STAFF_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE"];
/** Documents an occupant (owner/resident) may print for their own building. */
export const OCCUPANT_DOCS = ["notice", "invitation", "minutes", "announcement"];

export type PrintViewer = { userId: string; role: string; viewer: "staff" | "manager" | "occupant" };

export async function resolvePrintViewer(buildingId: string): Promise<PrintViewer | null> {
  const s = await getEffectiveSession();
  if (!s?.user?.id) return null;
  const access = await getBuildingAccess(s.user.id, buildingId);
  if (!access) return null;
  return { userId: s.user.id, role: s.user.role, viewer: access.viewer };
}

/** Buildings the current user may print for (staff: all; manager: assigned; occupant: own units). */
export async function printableBuildings() {
  const s = await getEffectiveSession();
  if (!s?.user?.id) return { session: null, buildings: [] as { id: string; name: string; address: string; city: string }[] };
  const sel = { id: true, name: true, address: true, city: true } as const;
  if (STAFF_ROLES.includes(s.user.role)) return { session: s, buildings: await db.building.findMany({ orderBy: { name: "asc" }, select: sel }) };
  const ids = new Set<string>();
  if (s.user.role === "PROPERTY_ADMIN") (await managerBuildingIds(s.user.id)).forEach((id) => ids.add(id));
  const units = await db.unit.findMany({ where: { OR: [{ ownerId: s.user.id }, { residentId: s.user.id }, { occupancies: { some: { userId: s.user.id, endDate: null } } }] }, select: { buildingId: true } });
  units.forEach((u) => ids.add(u.buildingId));
  return { session: s, buildings: ids.size ? await db.building.findMany({ where: { id: { in: [...ids] } }, orderBy: { name: "asc" }, select: sel }) : [] };
}
