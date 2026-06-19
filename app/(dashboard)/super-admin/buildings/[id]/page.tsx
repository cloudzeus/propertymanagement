import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import { BuildingDashboard } from "./BuildingDashboard";

export const metadata = { title: "Κτήριο — Super Admin" };

export default async function BuildingDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");
  const me = await db.user.findUnique({ where: { id: session.user.id as string }, select: { role: true } });
  if (me?.role !== "SUPER_ADMIN") redirect("/admin");

  const building = await db.building.findUnique({
    where: { id },
    select: {
      id: true, name: true, address: true, city: true, postalCode: true,
      floors: true, basements: true, hasElevator: true,
      property: { select: { id: true, name: true, customer: { select: { name: true } } } },
      _count: {
        select: { units: true, files: true, infraPoints: true, contacts: true, recurringTasks: true },
      },
    },
  });
  if (!building) notFound();

  const millesimesSum = await db.unit.aggregate({
    where: { buildingId: id },
    _sum: { millesimes: true },
  });

  const files = await db.buildingFile.findMany({
    where: { buildingId: id },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, url: true, category: true, mimeType: true, sizeBytes: true, createdAt: true },
  });

  return (
    <BuildingDashboard
      building={{
        id: building.id,
        name: building.name,
        address: building.address,
        city: building.city,
        postalCode: building.postalCode,
        floors: building.floors,
        basements: building.basements,
        hasElevator: building.hasElevator,
        propertyId: building.property.id,
        propertyName: building.property.name,
        customerName: building.property.customer.name,
      }}
      kpis={{
        units: building._count.units,
        millesimes: Math.round((millesimesSum._sum.millesimes ?? 0) * 100) / 100,
        files: building._count.files,
        infraPoints: building._count.infraPoints,
        contacts: building._count.contacts,
        recurringTasks: building._count.recurringTasks,
      }}
      files={files.map((f) => ({ ...f, createdAt: f.createdAt.toISOString() }))}
    />
  );
}
