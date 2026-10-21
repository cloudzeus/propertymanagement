import { notFound } from "next/navigation";
import { requirePermission, getEffectivePermissions } from "@/lib/rbac/permissions";
import { getEffectiveSession } from "@/lib/auth-effective";
import { loadWorkOrderDetail } from "@/lib/rfq";
import { managedCustomerIds } from "@/lib/work/queries";
import { workActionViewer } from "@/lib/work/scope";
import { AutoRefresh } from "@/components/realtime/AutoRefresh";
import { WorkOrderDetailClient } from "./WorkOrderDetailClient";

export const metadata = { title: "Σύμβαση έργου" };
export const dynamic = "force-dynamic";

/** Company view of one back-to-back work order: facts, contracts, history and the «Ενέργειες» button. */
export default async function WorkOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePermission("work-orders", "view");
  const [eff, resolved, detail] = await Promise.all([getEffectiveSession(), getEffectivePermissions(), loadWorkOrderDetail(id)]);
  if (!detail || !eff) notFound();
  const role = eff.user.role as string;
  const userId = eff.user.id as string;
  // Same customer scope as the lists: a MANAGER with account-managed customers sees only theirs.
  const managed = await managedCustomerIds(userId, role);
  if (managed && !managed.includes(detail.wo.customerId)) notFound();
  const viewer = workActionViewer(role, userId, resolved?.perms ?? new Set());
  return (
    <>
      <WorkOrderDetailClient detail={detail} viewer={viewer} />
      <AutoRefresh scope="company" />
    </>
  );
}
