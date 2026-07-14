import Link from "next/link";
import { db } from "@/lib/db";
import { getEffectiveSession } from "@/lib/auth-effective";
import { MaintenanceKanban } from "./kanban";
import { RiToolsLine, RiArrowRightLine } from "react-icons/ri";
import type { FaultListItem } from "./types";

const STAFF = ["SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE"];
const DONE_WINDOW_DAYS = 14;

/**
 * Kanban βλαβών για τα dashboards του προσωπικού.
 * Scope ανά ρόλο: EMPLOYEE → ανατεθειμένες σε αυτόν (+ αδιάθετες ευθύνης εταιρίας),
 * MANAGER → βλάβες των πελατών του (αν έχει αναθέσεις), SUPER_ADMIN/ADMIN → όλες.
 */
export async function MaintenanceKanbanSection() {
  const eff = await getEffectiveSession();
  if (!eff || !STAFF.includes(eff.user.role as string)) return null;
  const role = eff.user.role as string;
  const userId = eff.user.id as string;

  let roleFilter: object | null = null;
  if (role === "EMPLOYEE") {
    roleFilter = { OR: [{ assignedToId: userId }, { assignedToId: null, handledBy: "COMPANY" }] };
  } else if (role === "MANAGER") {
    const mine = await db.customer.findMany({ where: { accountManagerId: userId }, select: { id: true } });
    if (mine.length > 0) roleFilter = { building: { customerId: { in: mine.map((c) => c.id) } } };
  }

  const doneSince = new Date(Date.now() - DONE_WINDOW_DAYS * 24 * 3600_000);
  const requests = await db.maintenanceRequest.findMany({
    where: {
      AND: [
        ...(roleFilter ? [roleFilter] : []),
        {
          OR: [
            { status: { in: ["OPEN", "ACKNOWLEDGED", "SCHEDULED", "IN_PROGRESS", "ON_HOLD"] } },
            { status: "COMPLETED", completedAt: { gte: doneSince } },
          ],
        },
      ],
    },
    orderBy: [{ slaDueAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    take: 120,
    include: {
      building: { select: { name: true } },
      unit: { select: { unitNumber: true } },
      categoryRef: { select: { name: true } },
      reportedBy: { select: { name: true, email: true } },
      assignedTo: { select: { name: true } },
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
    slaDueAt: r.slaDueAt?.toISOString() ?? null,
    scheduledDate: r.scheduledDate?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <RiToolsLine style={{ fontSize: 18, color: "var(--color-primary)" }} />
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--foreground)", margin: 0, flex: 1 }}>Βλάβες & Εργασίες</h2>
        <Link href="/admin/maintenance" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12.5, fontWeight: 600, color: "var(--color-primary)", textDecoration: "none" }}>
          Όλες οι βλάβες <RiArrowRightLine />
        </Link>
      </div>
      {items.length === 0 ? (
        <div style={{ padding: "18px 16px", border: "1px dashed var(--border)", borderRadius: "var(--radius-lg)", fontSize: 13, color: "var(--muted-foreground)" }}>
          Δεν υπάρχουν ενεργές βλάβες.
        </div>
      ) : (
        <MaintenanceKanban items={items} detailBase="/admin/maintenance" />
      )}
    </div>
  );
}
