import { db } from "@/lib/db";
import { requireCollaborator } from "@/lib/marketplace";
import { UnlinkedNotice } from "@/components/marketplace/UnlinkedNotice";
import { SupplierRequestsClient } from "./SupplierRequestsClient";
import type { FaultListItem } from "@/components/maintenance/types";

export const metadata = { title: "Αναθέσεις" };

export default async function SupplierRequestsPage() {
  const ctx = await requireCollaborator("mkt-tasks");
  if (!ctx.supplierId) return <UnlinkedNotice />;

  const rows = await db.maintenanceRequest.findMany({
    where: { supplierId: ctx.supplierId },
    orderBy: { createdAt: "desc" },
    take: 500,
    include: {
      building: { select: { name: true, address: true, city: true } },
      unit: { select: { unitNumber: true } },
      categoryRef: { select: { name: true } },
      assignedTo: { select: { name: true } },
    },
  });

  const items: FaultListItem[] = rows.map((r) => ({
    id: r.id, title: r.title, status: r.status, priority: r.priority, handledBy: r.handledBy,
    categoryName: r.categoryRef?.name ?? r.category ?? null,
    buildingName: [r.building.name, r.building.address, r.building.city].filter(Boolean).join(", "),
    unitLabel: r.unit ? `Μονάδα ${r.unit.unitNumber}` : null,
    reporterName: null, // the reporter's identity is not the supplier's concern
    assigneeName: r.assignedTo?.name ?? null,
    slaDueAt: r.slaDueAt?.toISOString() ?? null,
    scheduledDate: r.scheduledDate?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  }));

  return <SupplierRequestsClient items={items} />;
}
