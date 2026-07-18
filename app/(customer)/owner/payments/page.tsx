import { redirect } from "next/navigation";
import { getEffectiveSession } from "@/lib/auth-effective";
import { getOwnerAllocRows } from "@/lib/dashboard/owner-queries";
import { PaymentsView } from "@/components/dashboard/payments-view";

export const metadata = { title: "Πληρωμές" };

export default async function OwnerPaymentsPage() {
  const eff = await getEffectiveSession();
  if (!eff?.user?.id) redirect("/login");
  const userId = eff.user.id;

  const rows = await getOwnerAllocRows(userId);

  return <PaymentsView rows={rows} title="Πληρωμές" />;
}
