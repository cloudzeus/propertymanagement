import { db } from "@/lib/db";
import { getBuildingAccess } from "@/lib/building-access";
import { canAccessRequest } from "@/lib/maintenance-requests";
import { ACCESS_DENIED, type AssistantCtx } from "./types";

export type Resolved = { id: string; name: string };
const norm = (s: string) => s.toLowerCase().trim();

/** Buildings reachable in the caller's scope (occupant + manager). Staff resolve by search instead. */
export async function scopeBuildings(ctx: AssistantCtx): Promise<Resolved[]> {
  const map = new Map<string, string>();
  for (const u of ctx.scope.occupantUnits) map.set(u.buildingId, u.buildingName);
  const missing = ctx.scope.managerBuildingIds.filter((id) => !map.has(id));
  if (missing.length) {
    for (const b of await db.building.findMany({ where: { id: { in: missing } }, select: { id: true, name: true } })) map.set(b.id, b.name);
  }
  return [...map.entries()].map(([id, name]) => ({ id, name }));
}

/** Resolve a building from an explicit id, a name, the page, or a single-building scope — always authorized. */
export async function resolveBuilding(ctx: AssistantCtx, q: { buildingId?: string | null; buildingName?: string | null }): Promise<Resolved | { error: string }> {
  if (q.buildingId) {
    const access = await getBuildingAccess(ctx.user.id, q.buildingId);
    if (!access) return { error: ACCESS_DENIED };
    const b = await db.building.findUnique({ where: { id: q.buildingId }, select: { id: true, name: true } });
    return b ?? { error: ACCESS_DENIED };
  }
  if (q.buildingName?.trim()) {
    const needle = norm(q.buildingName);
    const candidates: Resolved[] = ctx.scope.seesAllCustomers
      ? await db.building.findMany({ where: { name: { contains: q.buildingName.trim(), mode: "insensitive" } }, select: { id: true, name: true }, take: 5 })
      : (await scopeBuildings(ctx)).filter((b) => norm(b.name).includes(needle));
    if (candidates.length === 1) return candidates[0];
    if (candidates.length > 1) return { error: `Βρήκα ${candidates.length} κτήρια: ${candidates.map((c) => c.name).join(", ")}. Ποιο εννοείτε;` };
    if (ctx.scope.seesAllCustomers) return { error: `Δεν βρέθηκε κτήριο με όνομα «${q.buildingName}».` };
  }
  if (ctx.page.buildingId) return { id: ctx.page.buildingId, name: ctx.page.buildingName ?? "" };
  if (!ctx.scope.seesAllCustomers) {
    const all = await scopeBuildings(ctx);
    if (all.length === 1) return all[0];
  }
  return { error: "Σε ποιο κτήριο αναφέρεστε;" };
}

/** Resolve a fault request by id, title or the page — authorized through canAccessRequest. */
export async function resolveRequest(ctx: AssistantCtx, q: { requestId?: string | null; requestTitle?: string | null }): Promise<Resolved | { error: string }> {
  const check = async (id: string) => {
    if (!(await canAccessRequest(ctx.user.id, ctx.user.role, id))) return { error: ACCESS_DENIED };
    const r = await db.maintenanceRequest.findUnique({ where: { id }, select: { id: true, title: true } });
    return r ? { id: r.id, name: r.title } : { error: ACCESS_DENIED };
  };
  if (q.requestId) return check(q.requestId);
  if (q.requestTitle?.trim()) {
    const rows = await db.maintenanceRequest.findMany({
      where: { title: { contains: q.requestTitle.trim(), mode: "insensitive" }, ...(ctx.scope.seesAllCustomers ? {} : { reportedById: ctx.user.id }) },
      select: { id: true, title: true }, orderBy: { createdAt: "desc" }, take: 5,
    });
    if (rows.length === 1) return check(rows[0].id);
    if (rows.length > 1) return { error: `Βρήκα ${rows.length} βλάβες: ${rows.map((r) => r.title).join(", ")}. Ποια εννοείτε;` };
    return { error: `Δεν βρέθηκε βλάβη με τίτλο «${q.requestTitle}».` };
  }
  if (ctx.page.requestId) return check(ctx.page.requestId);
  return { error: "Σε ποια βλάβη αναφέρεστε;" };
}

export const hrefForFault = (ctx: AssistantCtx, id: string) =>
  ctx.surface === "company" ? `/admin/maintenance/${id}` : ctx.surface === "marketplace" ? `/marketplace/requests/${id}` : `/portal/requests/${id}`;
