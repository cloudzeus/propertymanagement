import { redirect } from "next/navigation";
import { getEffectiveSession } from "@/lib/auth-effective";
import { ResidentHome } from "@/components/dashboard/homes/ResidentHome";

export default async function PortalDashboard() {
  const eff = await getEffectiveSession();
  if (!eff?.user?.id) redirect("/login");
  return <ResidentHome userId={eff.user.id} companyId={eff.user.companyId ?? undefined} userName={eff.user.name} />;
}
