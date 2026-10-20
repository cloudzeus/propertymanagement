import { requirePermission } from "@/lib/rbac/permissions";
import { getEffectiveSession } from "@/lib/auth-effective";
import { db } from "@/lib/db";
import { managerBuildingIds } from "@/lib/building-access";
import { HelpCenter } from "@/components/help/HelpCenter";

export const metadata = { title: "Βοήθεια & οδηγίες" };

type SP = Record<string, string | string[] | undefined>;
const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

/** First building in the viewer's scope (managed or occupied) — used to open `[id]` guides on a real page. */
async function firstBuildingFor(userId: string, role: string): Promise<string | null> {
  if (role === "PROPERTY_ADMIN") {
    const ids = await managerBuildingIds(userId);
    if (ids[0]) return ids[0];
  }
  const unit = await db.unit.findFirst({ where: { OR: [{ ownerId: userId }, { residentId: userId }, { occupancies: { some: { userId, endDate: null } } }] }, select: { buildingId: true } });
  return unit?.buildingId ?? null;
}

export default async function PortalHelpPage({ searchParams }: { searchParams?: Promise<SP> }) {
  await requirePermission("customer-help", "view");
  const [eff, sp, company] = await Promise.all([
    getEffectiveSession(),
    searchParams ?? Promise.resolve({} as SP),
    db.company.findFirst({ orderBy: { createdAt: "asc" }, select: { phone1: true, email: true } }),
  ]);
  const role = eff?.user.role ?? "PROPERTY_RESIDENT";
  const firstBuildingId = eff ? await firstBuildingFor(eff.user.id, role) : null;
  return <HelpCenter role={role} base="/portal/help" requested={str(sp.m)} article={str(sp.a)} q={str(sp.q)} firstBuildingId={firstBuildingId} supportPhone={company?.phone1} supportEmail={company?.email} />;
}
