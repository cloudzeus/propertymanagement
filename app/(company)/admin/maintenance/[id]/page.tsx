import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/rbac/permissions";
import { getEffectiveSession } from "@/lib/auth-effective";
import { db } from "@/lib/db";
import { loadFaultDetail } from "@/lib/maintenance-requests";
import { describeRank } from "@/lib/supplier-ranking";
import { listRfqCandidates } from "@/lib/rfq-candidates";
import { getEffectivePermissions, can } from "@/lib/rbac/permissions";
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
  const resolved = await getEffectivePermissions();
  const canRfqView = !!resolved && can(resolved.perms, "rfq", "view");
  const canRfqCreate = !!resolved && can(resolved.perms, "rfq", "create");
  let employees: { id: string; name: string }[] = [];
  let supplierOptions: { id: string; name: string }[] = [];
  let preferredSupplierId: string | null = null;

  // Ranked registry suppliers (continuity, specialty, rating, proximity) — shared
  // by the assignment select and the RFQ picker.
  const picker = canAssign || canRfqView ? await listRfqCandidates(id) : { candidates: [], categories: [], defaultCategoryId: null };
  if (canAssign) {
    const [emps, preferred] = await Promise.all([
      db.user.findMany({ where: { role: { in: ["EMPLOYEE", "MANAGER"] }, status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true, email: true } }),
      db.buildingPreferredSupplier.findMany({ where: { buildingId: detail.buildingId, OR: [{ categoryId: detail.categoryId ?? "-" }, { categoryId: null }] }, select: { supplierId: true, categoryId: true } }),
    ]);
    employees = emps.map((e) => ({ id: e.id, name: e.name ?? e.email }));
    // category-specific preference wins over the building-wide one
    preferredSupplierId = (preferred.find((p) => p.categoryId) ?? preferred[0])?.supplierId ?? null;
    supplierOptions = picker.candidates.map((r) => ({ id: r.id, name: describeRank({ ...r, lat: null, lng: null, preferred: false, lastUsedHere: false, onboarded: true }) }));
  }
  const rfqPanel = canRfqView ? await loadRfqPanel(id) : null;

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
        <RfqPanel requestId={id} handledBy={detail.handledBy} rfqs={rfqPanel.rfqs} workOrders={rfqPanel.workOrders} defaults={rfqPanel.defaults} picker={picker} canCreate={canRfqCreate} />
      )}
    </div>
  );
}
