import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/rbac/permissions";
import { getEffectiveSession } from "@/lib/auth-effective";
import { db } from "@/lib/db";
import { loadFaultDetail } from "@/lib/maintenance-requests";
import { RequestDetail } from "@/components/maintenance/request-detail";
import { RiArrowLeftLine } from "react-icons/ri";

export const metadata = { title: "Βλάβη" };

export default async function MaintenanceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePermission("maintenance", "view");
  const eff = await getEffectiveSession();
  const role = eff!.user.role as string;

  const detail = await loadFaultDetail(id);
  if (!detail) notFound();

  const employees = ["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(role)
    ? await db.user.findMany({
        where: { role: { in: ["EMPLOYEE", "MANAGER"] }, status: "ACTIVE" },
        orderBy: { name: "asc" },
        select: { id: true, name: true, email: true },
      })
    : [];

  return (
    <div className="dash-page" style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 920 }}>
      <Link href="/admin/maintenance" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--muted-foreground)", textDecoration: "none" }}>
        <RiArrowLeftLine /> Πίσω στις βλάβες
      </Link>
      <RequestDetail
        request={detail}
        viewer={{
          id: eff!.user.id as string,
          role,
          isStaff: true,
          canManage: true,
          canAssign: ["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(role),
        }}
        employees={employees.map((e) => ({ id: e.id, name: e.name ?? e.email }))}
      />
    </div>
  );
}
