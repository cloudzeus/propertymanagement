import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/permissions";
import { requireCollaborator } from "@/lib/marketplace";
import { UnlinkedNotice } from "@/components/marketplace/UnlinkedNotice";
import { loadFaultDetail } from "@/lib/maintenance-requests";
import { RequestDetail } from "@/components/maintenance/request-detail";
import { RiArrowLeftLine } from "react-icons/ri";

export const metadata = { title: "Ανάθεση" };

export default async function SupplierRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireCollaborator("mkt-tasks");
  if (!ctx.supplierId) return <UnlinkedNotice />;

  // Strict scoping: a supplier only ever opens work assigned to THEM (or a fault they reported via /report).
  const owned = await db.maintenanceRequest.findFirst({ where: { id, OR: [{ supplierId: ctx.supplierId }, { reportedById: ctx.userId }] }, select: { id: true } });
  if (!owned) notFound();
  const detail = await loadFaultDetail(id);
  if (!detail) notFound();

  return (
    <div className="dash-page" style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 920 }}>
      <Link href="/marketplace/requests" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "var(--fs-13)", color: "var(--muted-foreground)", textDecoration: "none" }}>
        <RiArrowLeftLine /> Πίσω στις αναθέσεις
      </Link>
      <RequestDetail
        request={{ ...detail, reporterName: null }}
        viewer={{ id: ctx.userId, role: "COLLABORATOR", isStaff: false, canManage: can(ctx.perms, "mkt-tasks", "edit"), canAssign: false }}
        employees={[]}
      />
    </div>
  );
}
