import { db } from "@/lib/db";
import type { EffectiveSession } from "@/lib/auth-effective";
import { getBuildingAccess, managerBuildingIds } from "@/lib/building-access";
import { getEffectivePermissions } from "@/lib/rbac/permissions";
import { canAccessRequest } from "@/lib/maintenance-requests";
import { surfaceForRole } from "@/lib/surfaces";
import { COMPANY_ROLES, CUSTOMER_ROLES } from "@/lib/roles-constants";
import type { PageContext } from "./page-context";
import type { AssistantCtx } from "@/lib/ai/tools/types";

/** Resolve the caller's scope + authorize the page ids. Ids that fail the guards are dropped, never passed on. */
export async function buildAssistantContext(eff: EffectiveSession, page: PageContext): Promise<AssistantCtx> {
  const role = eff.user.role as string;
  const userId = eff.user.id;
  const isStaff = (COMPANY_ROLES as readonly string[]).includes(role);
  const isCustomer = (CUSTOMER_ROLES as readonly string[]).includes(role);

  const [resolved, mgrIds, units, supplierRow] = await Promise.all([
    getEffectivePermissions(),
    role === "PROPERTY_ADMIN" ? managerBuildingIds(userId) : Promise.resolve([] as string[]),
    isCustomer
      ? db.unit.findMany({
          where: { OR: [{ ownerId: userId }, { residentId: userId }, { occupancies: { some: { userId, endDate: null } } }] },
          select: { id: true, unitNumber: true, buildingId: true, ownerId: true, residentId: true, building: { select: { name: true } }, occupancies: { where: { userId, endDate: null }, select: { role: true } } },
          orderBy: { unitNumber: "asc" },
        })
      : Promise.resolve([]),
    role === "COLLABORATOR" ? db.user.findUnique({ where: { id: userId }, select: { supplierId: true } }) : Promise.resolve(null),
  ]);

  const occupantUnits = units.map((u) => ({
    unitId: u.id, unitNumber: u.unitNumber, buildingId: u.buildingId, buildingName: u.building.name,
    role: (u.ownerId === userId || u.occupancies.some((o) => o.role === "OWNER") ? "OWNER" : "RESIDENT") as "OWNER" | "RESIDENT",
  }));

  const safePage: AssistantCtx["page"] = { path: page.path };
  if (page.tab) safePage.tab = page.tab;
  if (page.buildingId) {
    const access = await getBuildingAccess(userId, page.buildingId);
    if (access) {
      safePage.buildingId = page.buildingId;
      const b = await db.building.findUnique({ where: { id: page.buildingId }, select: { name: true } });
      if (b?.name) safePage.buildingName = b.name;
    }
  }
  if (page.requestId && (await canAccessRequest(userId, role, page.requestId))) safePage.requestId = page.requestId;

  return {
    user: { id: userId, name: eff.user.name, email: eff.user.email, role, customerId: eff.user.customerId, companyId: eff.user.companyId },
    real: { id: eff.real.id, role: eff.real.role as string },
    impersonating: !!eff.impersonatorId,
    surface: surfaceForRole(role as never),
    perms: resolved?.perms ?? new Set<string>(),
    scope: { seesAllCustomers: isStaff, managerBuildingIds: mgrIds, occupantUnits, supplierId: supplierRow?.supplierId ?? null },
    page: safePage,
    now: new Date(),
  };
}
