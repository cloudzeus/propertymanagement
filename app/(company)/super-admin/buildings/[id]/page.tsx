import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import { BuildingDashboard } from "./BuildingDashboard";
import { getBuildingDashboardData } from "@/lib/building/dashboard-data";
import { capsForStaff } from "@/lib/building-caps";

export const metadata = { title: "Κτήριο — Super Admin" };

export default async function BuildingDashboardPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const session = await auth();
  if (!session?.user) redirect("/login");
  const me = await db.user.findUnique({ where: { id: session.user.id as string }, select: { role: true } });
  if (me?.role !== "SUPER_ADMIN") redirect("/admin");

  const rawHeatingPeriod = typeof resolvedSearchParams?.heatingPeriod === "string" ? resolvedSearchParams.heatingPeriod : null;
  const data = await getBuildingDashboardData(id, { heatingPeriod: rawHeatingPeriod });
  if (!data) notFound();

  return <BuildingDashboard {...data} can={capsForStaff()} />;
}
