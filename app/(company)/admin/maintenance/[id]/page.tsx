import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/rbac/permissions";
import { getEffectiveSession } from "@/lib/auth-effective";
import { db } from "@/lib/db";
import { loadFaultDetail } from "@/lib/maintenance-requests";
import { rankSuppliers, describeRank } from "@/lib/supplier-ranking";
import { RequestDetail } from "@/components/maintenance/request-detail";
import { RfqPanel } from "@/components/maintenance/rfq-panel";
import { loadRfqPanel } from "@/lib/rfq";
import { RiArrowLeftLine } from "react-icons/ri";

export const metadata = { title: "Βλάβη" };

export default async function MaintenanceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePermission("maintenance", "view");
  const eff = await getEffectiveSession();
  const role = eff!.user.role as string;

  const detail = await loadFaultDetail(id);
  if (!detail) notFound();

  const canAssign = ["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(role);
  let employees: { id: string; name: string }[] = [];
  let supplierOptions: { id: string; name: string }[] = [];
  let preferredSupplierId: string | null = null;

  if (canAssign) {
    const req = await db.maintenanceRequest.findUnique({
      where: { id },
      select: { categoryId: true, priority: true, buildingId: true, building: { select: { lat: true, lng: true } } },
    });
    const [emps, suppliers, preferred, usedHere] = await Promise.all([
      db.user.findMany({ where: { role: { in: ["EMPLOYEE", "MANAGER"] }, status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true, email: true } }),
      // Company registry only — a customer's private cards are never assignable.
      db.supplier.findMany({
        where: { customerId: null, isPlatform: false, isActive: true },
        select: { id: true, name: true, lat: true, lng: true, ratingAvg: true, ratingCount: true, emergency24h: true, onboardedAt: true, categories: { select: { categoryId: true } } },
      }),
      db.buildingPreferredSupplier.findMany({
        where: { buildingId: req!.buildingId, OR: [{ categoryId: req!.categoryId ?? "-" }, { categoryId: null }] },
        select: { supplierId: true, categoryId: true },
      }),
      db.maintenanceRequest.findMany({
        where: { buildingId: req!.buildingId, supplierId: { not: null }, id: { not: id } },
        distinct: ["supplierId"], select: { supplierId: true },
      }),
    ]);
    employees = emps.map((e) => ({ id: e.id, name: e.name ?? e.email }));
    // category-specific preference wins over the building-wide one
    preferredSupplierId = (preferred.find((p) => p.categoryId) ?? preferred[0])?.supplierId ?? null;
    const used = new Set(usedHere.map((u) => u.supplierId));
    const ranked = rankSuppliers(
      suppliers.map((s) => ({
        id: s.id, name: s.name, lat: s.lat, lng: s.lng, ratingAvg: s.ratingAvg, ratingCount: s.ratingCount,
        emergency24h: s.emergency24h, categoryIds: s.categories.map((c) => c.categoryId),
        preferred: s.id === preferredSupplierId, lastUsedHere: used.has(s.id), onboarded: !!s.onboardedAt,
      })),
      { categoryId: req!.categoryId, lat: req!.building.lat, lng: req!.building.lng, priority: req!.priority },
    );
    supplierOptions = ranked.map((r) => ({ id: r.id, name: describeRank(r) }));
  }
  const rfqPanel = canAssign ? await loadRfqPanel(id) : null;

  return (
    <div className="dash-page" style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 920 }}>
      <Link href="/admin/maintenance" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "var(--fs-13)", color: "var(--muted-foreground)", textDecoration: "none" }}>
        <RiArrowLeftLine /> Πίσω στις βλάβες
      </Link>
      <RequestDetail
        request={detail}
        viewer={{ id: eff!.user.id as string, role, isStaff: true, canManage: true, canAssign }}
        employees={employees}
        suppliers={supplierOptions}
        preferredSupplierId={preferredSupplierId}
      />
      {rfqPanel && (
        <RfqPanel requestId={id} handledBy={detail.handledBy} rfqs={rfqPanel.rfqs} workOrders={rfqPanel.workOrders} defaults={rfqPanel.defaults} suppliers={supplierOptions} />
      )}
    </div>
  );
}
