import { db } from "@/lib/db";
import { requirePermission } from "@/lib/rbac/permissions";
import { UsersClient } from "./UsersClient";

export const metadata = { title: "Χρήστες — Super Admin" };

export default async function UsersPage() {
  await requirePermission("users", "view");
  const [users, companies, roles] = await Promise.all([
    db.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true, name: true, email: true, role: true, roleId: true, status: true,
        companyId: true, lastLoginAt: true,
        company: { select: { name: true } },
        ownedUnits: { select: { unitNumber: true, building: { select: { name: true } }, customer: { select: { id: true, name: true } } } },
        residentUnits: { select: { unitNumber: true, building: { select: { name: true } }, customer: { select: { id: true, name: true } } } },
        managementAssignments: {
          select: {
            building: { select: { name: true, customer: { select: { id: true, name: true } } } },
            property: { select: { name: true, customer: { select: { id: true, name: true } } } },
          },
        },
      },
    }),
    db.company.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.role.findMany({
      orderBy: [{ isSystem: "desc" }, { label: "asc" }],
      select: { id: true, key: true, label: true, baseRole: true, surface: true, isSystem: true },
    }),
  ]);

  // Single-tenant managing company — used as the default for staff roles.
  const managing = await db.company.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });

  // Per-user scope, grouped by CUSTOMER. One email can participate across multiple
  // customers/properties (owner in customer X, resident in Y, manager in Z), so we
  // derive the associations from the actual relations — never the single user.customerId.
  const enriched = users.map((u) => {
    const groups = new Map<string, { id: string; name: string; roles: Set<string>; places: string[] }>();
    const bucket = (id: string | undefined, name: string | undefined) => {
      const key = id ?? "unknown";
      let g = groups.get(key);
      if (!g) { g = { id: key, name: name ?? "—", roles: new Set(), places: [] }; groups.set(key, g); }
      return g;
    };
    for (const un of u.ownedUnits) {
      const g = bucket(un.customer?.id, un.customer?.name);
      g.roles.add("Ιδιοκτήτης");
      g.places.push(`${un.building?.name ?? "—"} · ${un.unitNumber}`);
    }
    for (const un of u.residentUnits) {
      const g = bucket(un.customer?.id, un.customer?.name);
      g.roles.add("Ένοικος");
      g.places.push(`${un.building?.name ?? "—"} · ${un.unitNumber}`);
    }
    for (const ma of u.managementAssignments) {
      if (ma.building) {
        const g = bucket(ma.building.customer?.id, ma.building.customer?.name);
        g.roles.add("Διαχειριστής");
        g.places.push(ma.building.name);
      } else if (ma.property) {
        const g = bucket(ma.property.customer?.id, ma.property.customer?.name);
        g.roles.add("Διαχειριστής");
        g.places.push(`${ma.property.name} (όλα τα κτήρια)`);
      }
    }
    const { ownedUnits: _o, residentUnits: _r, managementAssignments: _m, ...rest } = u;
    return {
      ...rest,
      customers: Array.from(groups.values()).map((g) => ({
        id: g.id,
        name: g.name,
        roles: Array.from(g.roles),
        places: Array.from(new Set(g.places)),
      })),
    };
  });

  return <UsersClient initial={enriched} companies={companies} roles={roles} managingCompanyId={managing?.id ?? ""} />;
}
