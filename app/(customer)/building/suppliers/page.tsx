import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission, getEffectivePermissions, can } from "@/lib/rbac/permissions";
import { getEffectiveSession } from "@/lib/auth-effective";
import { homePathForRole } from "@/lib/surfaces";
import { customerVisibleWhere, ensurePlatformSupplier, supplierListInclude, supplierToDTO } from "@/lib/suppliers";
import { managerBuildingIds } from "@/lib/building-access";
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
          <div style={{ fontSize: "var(--fs-17)", fontWeight: 700, color: "var(--foreground)" }}>Ο λογαριασμός σας δεν έχει συνδεθεί με πελάτη.</div>
          <p style={{ margin: "8px 0 0", fontSize: "var(--fs-13)", color: "var(--muted-foreground)" }}>Επικοινωνήστε με την εταιρεία διαχείρισης.</p>
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
  // For "ask offer / appointment": the manager's buildings, their open faults, and past inquiries.
  const managed = await managerBuildingIds(eff.user.id);
  const [buildings, faults, inquiries] = await Promise.all([
    db.building.findMany({ where: { id: { in: managed } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.maintenanceRequest.findMany({ where: { buildingId: { in: managed }, status: { notIn: ["COMPLETED", "CANCELLED"] } }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, title: true, buildingId: true } }),
    db.supplierInquiry.findMany({ where: { customerId }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, kind: true, status: true, message: true, preferredDates: true, sentTo: true, answer: true, answeredAt: true, createdAt: true, supplier: { select: { id: true, name: true } }, building: { select: { name: true } }, maintenanceRequest: { select: { id: true, title: true } } } }),
  ]);

  return (
    <PrivateSuppliersClient
      suppliers={rows.map(supplierToDTO)}
      categories={categories}
      caps={{ create: can(perms, "customer-suppliers", "create"), edit: can(perms, "customer-suppliers", "edit"), delete: can(perms, "customer-suppliers", "delete") }}
      buildings={buildings}
      faults={faults}
      inquiries={inquiries.map((i) => ({ id: i.id, kind: i.kind, status: i.status, message: i.message, preferredDates: (i.preferredDates as string[] | null) ?? [], sentTo: i.sentTo, answer: i.answer, answeredAt: i.answeredAt?.toISOString() ?? null, createdAt: i.createdAt.toISOString(), supplierId: i.supplier.id, supplierName: i.supplier.name, buildingName: i.building.name, faultId: i.maintenanceRequest?.id ?? null, faultTitle: i.maintenanceRequest?.title ?? null }))}
    />
  );
}
