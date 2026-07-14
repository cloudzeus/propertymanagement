import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getEffectiveSession } from "@/lib/auth-effective";
import { loadFaultDetail, canAccessRequest } from "@/lib/maintenance-requests";
import { RequestDetail } from "@/components/maintenance/request-detail";
import { RiArrowLeftLine } from "react-icons/ri";

export const metadata = { title: "Αίτημα βλάβης" };

export default async function PortalRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const eff = await getEffectiveSession();
  if (!eff) redirect("/login");
  const userId = eff.user.id as string;
  const role = eff.user.role as string;

  if (!(await canAccessRequest(userId, role, id))) redirect("/unauthorized");
  const detail = await loadFaultDetail(id);
  if (!detail) notFound();

  return (
    <div className="dash-page" style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 920 }}>
      <Link href="/portal/requests" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--muted-foreground)", textDecoration: "none" }}>
        <RiArrowLeftLine /> Πίσω στα αιτήματα
      </Link>
      <RequestDetail
        request={detail}
        viewer={{ id: userId, role, isStaff: false, canManage: false, canAssign: false }}
        employees={[]}
      />
    </div>
  );
}
