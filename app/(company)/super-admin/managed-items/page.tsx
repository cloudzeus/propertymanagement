import { db } from "@/lib/db";
import { requirePermission } from "@/lib/rbac/permissions";
import { ManagedItemTypesClient } from "./ManagedItemTypesClient";

export const metadata = { title: "Στοιχεία Διαχείρισης" };

export default async function ManagedItemsPage() {
  await requirePermission("managed-items", "view");

  const types = await db.managedItemType.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true, name: true, notes: true, active: true,
      _count: { select: { items: true } },
    },
  });

  return (
    <ManagedItemTypesClient
      types={types.map((t) => ({ id: t.id, name: t.name, notes: t.notes, active: t.active, usage: t._count.items }))}
    />
  );
}
