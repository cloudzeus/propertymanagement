import { getScope, customerWhere } from "@/lib/scope";
import { db } from "@/lib/db";
import AnnouncementComposer from "./AnnouncementComposer";

export default async function AnnouncementsPage() {
  const scope = await getScope();
  const buildings = await db.building.findMany({
    where: customerWhere(scope),
    select: { id: true, name: true, propertyId: true, property: { select: { id: true, name: true } } },
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
