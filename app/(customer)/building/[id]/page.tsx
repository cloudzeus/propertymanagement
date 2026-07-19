import { getEffectiveSession } from "@/lib/auth-effective";
import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { getBuildingAccess, managerBuildingIds } from "@/lib/building-access";
import { getBuildingDashboardData } from "@/lib/building/dashboard-data";
import { getOccupantControlCenter } from "@/lib/building/occupant-data";
import { getBuildingOutstanding, getPropertyVivaConfig, isKoinochristaPayEnabled } from "@/lib/payments/koinochrista-pay";
import { BuildingManagerShell } from "@/components/building/manager-shell/BuildingManagerShell";
import { OccupantBuildingShell } from "@/components/building/occupant-shell/OccupantBuildingShell";

export const metadata = { title: "Το κτήριό μου" };

export default async function ManagerBuildingPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  // Effective session so super-admin View-as PROPERTY_ADMIN exercises this surface.
  const session = await getEffectiveSession();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;
  const access = await getBuildingAccess(userId, id);
  if (!access) notFound();

  if (access.viewer === "occupant") {
    const month = typeof sp.month === "string" ? sp.month : null;
    const data = await getOccupantControlCenter(id, userId, { month });
    if (!data) notFound();
    // Quick-pay: outstanding is ALWAYS computed server-side from the viewer's own
    // unpaid allocations; the client never sends an amount. `enabled` is the
    // per-property Viva gate (the property's OWN account) AND the master switch —
    // off everywhere today, so the card shows «Σύντομα διαθέσιμο».
    const [outstanding, vivaConfig] = await Promise.all([
      getBuildingOutstanding(userId, id),
      getPropertyVivaConfig(id),
    ]);
    const quickPay = {
      perUnit: outstanding.perUnit.map((u) => ({ unitId: u.unitId, unitNumber: u.unitNumber, amountCents: u.amountCents })),
      totalCents: outstanding.totalCents,
      enabled: isKoinochristaPayEnabled(vivaConfig),
    };
    return <OccupantBuildingShell {...data} viewerRole={session.user.role} managed={access.managed} quickPay={quickPay} />;
  }

  const heatingPeriod = typeof sp.heatingPeriod === "string" ? sp.heatingPeriod : null;
  const [data, siblingIds] = await Promise.all([
    getBuildingDashboardData(id, { heatingPeriod }),
    access.viewer === "manager" ? managerBuildingIds(userId) : Promise.resolve([id]),
  ]);
  if (!data) notFound();
  const siblings = siblingIds.length > 1
    ? await db.building.findMany({ where: { id: { in: siblingIds } }, select: { id: true, name: true }, orderBy: { name: "asc" } })
    : [];

  return <BuildingManagerShell {...data} can={access.can} viewer={access.viewer} managed={access.managed} siblings={siblings} />;
}
