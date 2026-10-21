import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission, getEffectivePermissions, can } from "@/lib/rbac/permissions";
import { getEffectiveSession } from "@/lib/auth-effective";
import { loadFaultDetail } from "@/lib/maintenance-requests";
import { loadRfqPanel } from "@/lib/rfq";
import { workActionViewer } from "@/lib/work/scope";
import { FaultDetailClient } from "@/components/maintenance/FaultDetailClient";
import { RiArrowLeftLine } from "react-icons/ri";

export const metadata = { title: "Βλάβη" };

/** Company view of a fault: header + «Ενέργειες», appointments, offers/work orders, communication, history. */
export default async function MaintenanceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePermission("maintenance", "view");
  const [eff, resolved, detail] = await Promise.all([getEffectiveSession(), getEffectivePermissions(), loadFaultDetail(id)]);
  if (!detail || !eff) notFound();
  const role = eff.user.role as string;
  const userId = eff.user.id as string;
  const viewer = workActionViewer(role, userId, resolved?.perms ?? new Set());
  const canRfqView = !!resolved && can(resolved.perms, "rfq", "view");
  const rfqPanel = canRfqView ? await loadRfqPanel(id) : null;

  return (
    <div className="dash-page" style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 920 }}>
      <Link href="/admin/maintenance" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "var(--fs-13)", color: "var(--muted-foreground)", textDecoration: "none" }}>
        <RiArrowLeftLine /> Πίσω στις βλάβες
      </Link>
      <FaultDetailClient
        detail={detail}
        viewer={viewer}
        legacyViewer={{ id: userId, role, isStaff: true, canManage: true, canAssign: viewer.canAssign }}
        rfqPanel={rfqPanel ? { rfqs: rfqPanel.rfqs, workOrders: rfqPanel.workOrders, zones: rfqPanel.zones } : null}
      />
    </div>
  );
}
