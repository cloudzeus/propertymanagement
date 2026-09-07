import { redirect } from "next/navigation";
import { getEffectiveSession } from "@/lib/auth-effective";
import { db } from "@/lib/db";
import { managerBuildingIds } from "@/lib/building-access";
import { MobileReportForm } from "@/components/maintenance/MobileReportForm";
import type { BuildingOption } from "@/components/maintenance/types";

export const metadata = { title: "Δήλωση βλάβης" };

const STAFF = ["SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE"];

/**
 * One fault-report page for every role. Which buildings appear depends on who
 * you are: staff → all; manager → managed; owner/resident → own units;
 * supplier → buildings where they have (had) an assignment.
 */
export default async function ReportPage() {
  const eff = await getEffectiveSession();
  if (!eff) redirect("/login?next=/report");
  const userId = eff.user.id;
  const role = eff.user.role;
  const unitSel = { id: true, unitNumber: true, buildingId: true, building: { select: { id: true, name: true } } } as const;
  const map = new Map<string, BuildingOption>();
  const addBuilding = (b: { id: string; name: string; units: { id: string; unitNumber: string }[] }) => {
    if (!map.has(b.id)) map.set(b.id, { id: b.id, name: b.name, units: b.units.map((u) => ({ id: u.id, label: `Μονάδα ${u.unitNumber}` })) });
  };

  if (STAFF.includes(role)) {
    const rows = await db.building.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, units: { orderBy: { unitNumber: "asc" }, select: { id: true, unitNumber: true } } } });
    rows.forEach(addBuilding);
  } else if (role === "COLLABORATOR") {
    const u = await db.user.findUnique({ where: { id: userId }, select: { supplierId: true } });
    if (u?.supplierId) {
      const ids = [...new Set((await db.maintenanceRequest.findMany({ where: { supplierId: u.supplierId }, distinct: ["buildingId"], select: { buildingId: true } })).map((r) => r.buildingId))];
      const rows = await db.building.findMany({ where: { id: { in: ids } }, orderBy: { name: "asc" }, select: { id: true, name: true, units: { orderBy: { unitNumber: "asc" }, select: { id: true, unitNumber: true } } } });
      rows.forEach(addBuilding);
    }
  } else {
    const units = await db.unit.findMany({ where: { OR: [{ ownerId: userId }, { residentId: userId }, { occupancies: { some: { userId, endDate: null } } }] }, select: unitSel });
    for (const u of units) {
      const b = map.get(u.buildingId) ?? { id: u.building.id, name: u.building.name, units: [] };
      b.units.push({ id: u.id, label: `Μονάδα ${u.unitNumber}` });
      map.set(u.buildingId, b);
    }
    if (role === "PROPERTY_ADMIN") {
      const managed = await managerBuildingIds(userId);
      if (managed.length) {
        const rows = await db.building.findMany({ where: { id: { in: managed } }, select: { id: true, name: true, units: { orderBy: { unitNumber: "asc" }, select: { id: true, unitNumber: true } } } });
        rows.forEach(addBuilding);
      }
    }
  }
  const buildings = [...map.values()];
  const categories = await db.maintenanceCategory.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } });
  const detailBase = STAFF.includes(role) ? "/admin/maintenance" : role === "COLLABORATOR" ? "/marketplace/requests" : role === "PROPERTY_ADMIN" ? "/portal/maintenance" : "/portal/requests";

  if (buildings.length === 0) {
    return <div style={{ maxWidth: 520, margin: "40px auto", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: 28, textAlign: "center", fontSize: "var(--fs-13-5)", color: "var(--muted-foreground)" }}>
      {role === "COLLABORATOR" ? "Μπορείτε να δηλώσετε βλάβη μόνο σε κτήρια όπου έχετε ανάθεση." : "Δεν έχετε συνδεθεί με κάποιο κτήριο ακόμη — επικοινωνήστε με την εταιρεία διαχείρισης."}
    </div>;
  }
  return <MobileReportForm buildings={buildings} categories={categories} detailBase={detailBase} />;
}
