import { auth } from "@/auth";
import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { getBuildingAccess, managerBuildingIds } from "@/lib/building-access";
import { getBuildingDashboardData } from "@/lib/building/dashboard-data";
import { BuildingManagerShell } from "@/components/building/manager-shell/BuildingManagerShell";

export const metadata = { title: "Το κτήριό μου" };

export default async function ManagerBuildingPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id as string;
  const access = await getBuildingAccess(userId, id);
  if (!access) notFound();

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
