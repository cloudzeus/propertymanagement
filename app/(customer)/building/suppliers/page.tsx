import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission, getEffectivePermissions, can } from "@/lib/rbac/permissions";
import { getEffectiveSession } from "@/lib/auth-effective";
import { homePathForRole } from "@/lib/surfaces";
import { customerVisibleWhere, ensurePlatformSupplier, supplierListInclude, supplierToDTO } from "@/lib/suppliers";
import { PrivateSuppliersClient } from "./PrivateSuppliersClient";

export const metadata = { title: "Οι προμηθευτές μου" };

/**
 * The property manager's PRIVATE supplier list. Scoped to the manager's
 * Customer — never shows the company registry or other customers' rows.
 */
export default async function PrivateSuppliersPage() {
  await requirePermission("customer-suppliers", "view");
  const [eff, resolved] = await Promise.all([getEffectiveSession(), getEffectivePermissions()]);
  if (!eff) redirect("/login");
  if (eff.user.role !== "PROPERTY_ADMIN") redirect(homePathForRole(eff.user.role));

  const customerId = eff.user.customerId;
  if (!customerId) {
    return (
      <div style={{ display: "flex", justifyContent: "center", paddingTop: 60 }}>
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "40px 48px", textAlign: "center", maxWidth: 480 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: "var(--foreground)" }}>Ο λογαριασμός σας δεν έχει συνδεθεί με πελάτη.</div>
          <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--muted-foreground)" }}>Επικοινωνήστε με την εταιρεία διαχείρισης.</p>
        </div>
      </div>
    );
  }

  await ensurePlatformSupplier();
  const [rows, categories] = await Promise.all([
    db.supplier.findMany({
      where: customerVisibleWhere(customerId),
      orderBy: [{ isPlatform: "desc" }, { isActive: "desc" }, { name: "asc" }],
      include: supplierListInclude,
    }),
    db.maintenanceCategory.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);
  const perms = resolved!.perms;

  return (
    <PrivateSuppliersClient
      suppliers={rows.map(supplierToDTO)}
      categories={categories}
      caps={{ create: can(perms, "customer-suppliers", "create"), edit: can(perms, "customer-suppliers", "edit"), delete: can(perms, "customer-suppliers", "delete") }}
    />
  );
}
