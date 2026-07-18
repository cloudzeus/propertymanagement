import { requirePermission, getEffectivePermissions, can } from "@/lib/rbac/permissions";
import { getScope, customerWhere } from "@/lib/scope";
import { db } from "@/lib/db";
import { ResidentsClient, type PropertyRow, type Assignable } from "./ResidentsClient";

export const dynamic = "force-dynamic";

export default async function AdminResidentsPage() {
  await requirePermission("residents", "view");
  const [resolved, scope] = await Promise.all([getEffectivePermissions(), getScope()]);
  const perms = resolved!.perms;
  const canCreate = can(perms, "residents", "create");
  const canEdit = can(perms, "residents", "edit");
  const canDelete = can(perms, "residents", "delete");

  const where = customerWhere(scope);

  const [properties, assignableUsers] = await Promise.all([
    db.property.findMany({
      where,
      orderBy: { name: "asc" },
      select: {
        id: true, name: true, address: true, city: true,
        customer: { select: { id: true, name: true } },
        buildings: {
          orderBy: { name: "asc" },
          select: {
            id: true, name: true, address: true,
            units: {
              orderBy: { unitNumber: "asc" },
              select: {
                id: true, unitNumber: true, unitType: true, floor: true,
                owner: { select: { id: true, name: true, email: true, phone: true, mobile: true } },
                resident: { select: { id: true, name: true, email: true, phone: true, mobile: true } },
                occupancies: {
                  where: { endDate: null },
                  select: { userId: true, role: true, startDate: true },
                },
              },
            },
          },
        },
      },
    }),
    // Existing owner/resident users, scoped per customer (data isolation: the
    // client filters this list to the property's own customer before showing it).
    db.user.findMany({
      where: { ...where, role: { in: ["PROPERTY_OWNER", "PROPERTY_RESIDENT"] as any } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, customerId: true },
    }),
  ]);

  const rows: PropertyRow[] = properties.map((p) => {
    const buildings = p.buildings.map((b) => ({
      id: b.id,
      name: b.name,
      address: b.address,
      units: b.units.map((u) => {
        const occ = (userId: string | null, role: "OWNER" | "RESIDENT") => {
          const o = userId ? u.occupancies.find((x) => x.userId === userId && x.role === role) : null;
          return o ? o.startDate.toISOString() : null;
        };
        return {
          id: u.id,
          unitNumber: u.unitNumber,
          unitType: u.unitType as string,
          floor: u.floor,
          owner: u.owner ? { ...u.owner, since: occ(u.owner.id, "OWNER") } : null,
          resident: u.resident ? { ...u.resident, since: occ(u.resident.id, "RESIDENT") } : null,
        };
      }),
    }));
    const units = buildings.flatMap((b) => b.units);
    return {
      id: p.id,
      name: p.name,
      address: [p.address, p.city].filter(Boolean).join(", "),
      customerId: p.customer.id,
      customerName: p.customer.name,
      buildingsCount: buildings.length,
      unitsCount: units.length,
      ownersCount: units.filter((u) => u.owner).length,
      residentsCount: units.filter((u) => u.resident).length,
      vacantCount: units.filter((u) => !u.resident).length,
      buildings,
    };
  });

  const assignables: Assignable[] = assignableUsers.map((u) => ({
    id: u.id, name: u.name, email: u.email, customerId: u.customerId,
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--foreground)", margin: 0 }}>Ενοικιαστές &amp; Ιδιοκτήτες</h1>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 4 }}>
          {rows.length} ιδιοκτησίες · {rows.reduce((s, r) => s + r.unitsCount, 0)} μονάδες · {rows.reduce((s, r) => s + r.residentsCount, 0)} ένοικοι · {rows.reduce((s, r) => s + r.ownersCount, 0)} ιδιοκτήτες
        </p>
      </div>
      <ResidentsClient rows={rows} assignables={assignables} canCreate={canCreate} canEdit={canEdit} canDelete={canDelete} />
    </div>
  );
}
