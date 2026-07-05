import { getScope, customerWhere } from "@/lib/scope";
import { db } from "@/lib/db";
import AnnouncementComposer from "@/app/(company)/announcements/AnnouncementComposer";

export default async function PortalAnnouncementsPage() {
  const scope = await getScope();
  if (scope.role !== "PROPERTY_ADMIN") {
    return <div className="p-6 text-sm text-neutral-500">Δεν έχετε πρόσβαση.</div>;
  }
  const buildings = await db.building.findMany({
    where: customerWhere(scope),
    select: { id: true, name: true, propertyId: true, property: { select: { name: true } } },
    orderBy: { name: "asc" },
  });
  return (
    <AnnouncementComposer
      buildings={buildings.map((b) => ({
        id: b.id,
        name: b.name,
        propertyId: b.propertyId,
        propertyName: b.property?.name ?? null,
      }))}
    />
  );
}
