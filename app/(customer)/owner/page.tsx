import { redirect } from "next/navigation";
import { getEffectiveSession } from "@/lib/auth-effective";
import { OwnerHome } from "@/components/dashboard/homes/OwnerHome";

export default async function OwnerDashboard() {
  const eff = await getEffectiveSession();
  if (!eff?.user?.id) redirect("/login");
  return <OwnerHome userId={eff.user.id} userName={eff.user.name} />;
}
