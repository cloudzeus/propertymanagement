import { requirePermission, getEffectivePermissions } from "@/lib/rbac/permissions";
import { workActionViewer } from "@/lib/work/scope";
import { getEffectiveSession } from "@/lib/auth-effective";
import { db } from "@/lib/db";
import { MaintenanceListClient } from "./MaintenanceListClient";
import type { FaultListItem } from "@/components/maintenance/types";
import { faultFlags } from "@/lib/work/normalize";

export const metadata = { title: "Βλάβες & Συντηρήσεις" };

export default async function MaintenancePage() {
  await requirePermission("maintenance", "view");
  const eff = await getEffectiveSession();
  const role = eff!.user.role as string;

  // MANAGER με ανατεθειμένους πελάτες βλέπει μόνο τις βλάβες των δικών του πελατών.
  const userId = eff!.user.id as string;
  let customerScope: string[] | null = null;
  if (role === "MANAGER") {
    const mine = await db.customer.findMany({ where: { accountManagerId: userId }, select: { id: true } });
    if (mine.length > 0) customerScope = mine.map((c) => c.id);
  }

  const requests = await db.maintenanceRequest.findMany({
    where: customerScope ? { building: { customerId: { in: customerScope } } } : undefined,
    orderBy: { createdAt: "desc" },
    take: 500,
    include: {
      building: { select: { name: true } },
      unit: { select: { unitNumber: true } },
      categoryRef: { select: { name: true } },
      reportedBy: { select: { name: true, email: true } },
      assignedTo: { select: { name: true } },
      supplier: { select: { id: true, name: true } },
      serviceRequests: { where: { status: { in: ["OPEN", "OFFERED"] } }, select: { id: true, offers: { where: { status: "SUBMITTED" }, select: { id: true } } } },
      workOrders: { where: { status: { notIn: ["DECLINED", "CANCELLED", "CONFIRMED"] } }, orderBy: { createdAt: "desc" }, take: 1, select: { id: true, status: true } },
      _count: { select: { appointments: true } },
    },
  });

  const items: FaultListItem[] = requests.map((r) => ({
    id: r.id,
    title: r.title,
    status: r.status,
    priority: r.priority,
    handledBy: r.handledBy,
    categoryName: r.categoryRef?.name ?? r.category ?? null,
    buildingName: r.building.name,
    unitLabel: r.unit ? `Μονάδα ${r.unit.unitNumber}` : null,
    reporterName: r.reportedBy?.name ?? r.reportedBy?.email ?? null,
    assigneeName: r.assignedTo?.name ?? null,
    assigneeId: r.assignedToId,
    supplierId: r.supplier?.id ?? null,
    supplierName: r.supplier?.name ?? null,
    flags: faultFlags(r),
    slaDueAt: r.slaDueAt?.toISOString() ?? null,
    scheduledDate: r.scheduledDate?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  }));

  const resolved = await getEffectivePermissions();
  const viewer = workActionViewer(role, userId, resolved?.perms ?? new Set());

  const [buildings, categories] = await Promise.all([
    db.building.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, units: { orderBy: { unitNumber: "asc" }, select: { id: true, unitNumber: true } } },
    }),
    db.maintenanceCategory.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <MaintenanceListClient
      items={items}
      viewer={viewer}
      canEditSettings={["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(role)}
      buildings={buildings.map((b) => ({ id: b.id, name: b.name, units: b.units.map((u) => ({ id: u.id, label: `Μονάδα ${u.unitNumber}` })) }))}
      categories={categories}
    />
  );
}
