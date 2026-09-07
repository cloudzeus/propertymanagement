import Link from "next/link";
import { redirect } from "next/navigation";
import { getEffectiveSession } from "@/lib/auth-effective";
import { db } from "@/lib/db";
import { managerBuildingIds } from "@/lib/building-access";
import { MobileReportForm } from "@/components/maintenance/MobileReportForm";
import { RiArrowLeftLine } from "react-icons/ri";
import type { BuildingOption } from "@/components/maintenance/types";

export const metadata = { title: "Δήλωση βλάβης" };

/**
 * Mobile-first fault report for residents, owners and property managers.
 * Building access is enforced server-side by createMaintenanceRequest.
 */
export default async function NewRequestPage() {
  const eff = await getEffectiveSession();
  if (!eff) redirect("/login");
  const userId = eff.user.id;
  const role = eff.user.role;

  // Buildings the user occupies (owner/resident) + buildings they manage.
  const [units, managed] = await Promise.all([
    db.unit.findMany({
      where: { OR: [{ ownerId: userId }, { residentId: userId }, { occupancies: { some: { userId, endDate: null } } }] },
      select: { id: true, unitNumber: true, buildingId: true, building: { select: { id: true, name: true } } },
    }),
    role === "PROPERTY_ADMIN" ? managerBuildingIds(userId) : Promise.resolve([] as string[]),
  ]);
  const map = new Map<string, BuildingOption>();
  for (const u of units) {
    const b = map.get(u.buildingId) ?? { id: u.building.id, name: u.building.name, units: [] };
    b.units.push({ id: u.id, label: `Μονάδα ${u.unitNumber}` });
    map.set(u.buildingId, b);
  }
  if (managed.length) {
    const rows = await db.building.findMany({ where: { id: { in: managed } }, select: { id: true, name: true, units: { orderBy: { unitNumber: "asc" }, select: { id: true, unitNumber: true } } } });
    for (const b of rows) if (!map.has(b.id)) map.set(b.id, { id: b.id, name: b.name, units: b.units.map((u) => ({ id: u.id, label: `Μονάδα ${u.unitNumber}` })) });
  }
  const buildings = [...map.values()];
  const categories = await db.maintenanceCategory.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } });
  const detailBase = role === "PROPERTY_ADMIN" ? "/portal/maintenance" : "/portal/requests";
  const back = role === "PROPERTY_ADMIN" ? "/building" : role === "PROPERTY_OWNER" ? "/owner/requests" : "/portal/requests";

  return (
    <div className="dash-page" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Link href={back} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--muted-foreground)", textDecoration: "none" }}>
        <RiArrowLeftLine /> Πίσω
      </Link>
      {buildings.length === 0 ? (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: 28, textAlign: "center", fontSize: 13.5, color: "var(--muted-foreground)" }}>
          Δεν έχετε συνδεθεί με κάποιο κτήριο ακόμη — επικοινωνήστε με την εταιρεία διαχείρισης.
        </div>
      ) : (
        <MobileReportForm buildings={buildings} categories={categories} detailBase={detailBase} />
      )}
    </div>
  );
}
