import { redirect } from "next/navigation";
import { getEffectiveSession } from "@/lib/auth-effective";
import { getResidentPaymentRows } from "@/lib/dashboard/payment-statements";
import { PaymentsTable } from "@/components/dashboard/PaymentsTable";

export const metadata = { title: "Πληρωμές" };

export default async function PortalPaymentsPage() {
  const eff = await getEffectiveSession();
  if (!eff?.user?.id) redirect("/login");

  const rows = await getResidentPaymentRows(eff.user.id);

  return <PaymentsTable rows={rows} title="Πληρωμές" />;
}
