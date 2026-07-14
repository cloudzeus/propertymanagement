import Link from "next/link";
import { requirePermission } from "@/lib/rbac/permissions";
import { getEffectiveSession } from "@/lib/auth-effective";
import { db } from "@/lib/db";
import { NewRequestButton } from "@/components/maintenance/new-request-form";
import { EmptyState } from "@/components/dashboard";
import { STATUS_LABELS, STATUS_COLORS, type FaultStatus } from "@/lib/maintenance-shared";
import { RiToolsLine } from "react-icons/ri";

export const metadata = { title: "Αιτήματα βλαβών" };

const fmt = (d: Date) => d.toLocaleString("el-GR", { dateStyle: "short", timeStyle: "short" });

export default async function PortalRequestsPage() {
  await requirePermission("customer-requests", "view");
  const eff = await getEffectiveSession();
  const userId = eff!.user.id as string;

  // Κτήρια όπου ο χρήστης είναι ένοικος/ιδιοκτήτης (για τη φόρμα δήλωσης)
  const units = await db.unit.findMany({
    where: {
      OR: [
        { ownerId: userId },
        { residentId: userId },
        { occupancies: { some: { userId, endDate: null } } },
      ],
    },
    select: { id: true, unitNumber: true, buildingId: true, building: { select: { id: true, name: true } } },
  });
  const buildingsMap = new Map<string, { id: string; name: string; units: { id: string; label: string }[] }>();
  for (const u of units) {
    const b = buildingsMap.get(u.buildingId) ?? { id: u.building.id, name: u.building.name, units: [] };
    b.units.push({ id: u.id, label: `Μονάδα ${u.unitNumber}` });
    buildingsMap.set(u.buildingId, b);
  }
  const buildings = [...buildingsMap.values()];

  const [requests, categories] = await Promise.all([
    db.maintenanceRequest.findMany({
      where: { reportedById: userId },
      orderBy: { createdAt: "desc" },
      include: { building: { select: { name: true } }, categoryRef: { select: { name: true } } },
    }),
    db.maintenanceCategory.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <div className="dash-page" style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 860 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--foreground)", margin: 0, flex: 1 }}>Αιτήματα βλαβών</h1>
        {buildings.length > 0 && <NewRequestButton buildings={buildings} categories={categories} detailBase="/portal/requests" />}
      </div>

      {requests.length === 0 ? (
        <EmptyState icon={RiToolsLine} label="Δεν έχετε δηλώσει βλάβες." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {requests.map((r) => {
            const color = STATUS_COLORS[r.status as FaultStatus] ?? "#6b7280";
            return (
              <Link key={r.id} href={`/portal/requests/${r.id}`} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", textDecoration: "none",
                background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>{r.title}</div>
                  <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                    {r.building.name} · {r.categoryRef?.name ?? r.category} · {fmt(r.createdAt)}
                  </div>
                </div>
                <span style={{ padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, color, background: `${color}18`, border: `1px solid ${color}40`, whiteSpace: "nowrap" }}>
                  {STATUS_LABELS[r.status as FaultStatus] ?? r.status}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
