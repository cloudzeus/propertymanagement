import { redirect } from "next/navigation";
import { getEffectiveSession } from "@/lib/auth-effective";
import { getOwnerPaymentRows } from "@/lib/dashboard/payment-statements";
import { getPropertyVivaConfig, isKoinochristaPayEnabled } from "@/lib/payments/koinochrista-pay";
import { PaymentsTable } from "@/components/dashboard/PaymentsTable";

export const metadata = { title: "Λογαριασμοί" };

export default async function OwnerPaymentsPage() {
  const eff = await getEffectiveSession();
  if (!eff?.user?.id) redirect("/login");

  const rows = await getOwnerPaymentRows(eff.user.id);

  // Per-building pay gate: resolve once per distinct building (property's own Viva config + master switch).
  const buildingIds = [...new Set(rows.map((r) => r.buildingId))];
  const gates = await Promise.all(
    buildingIds.map(async (id) => [id, isKoinochristaPayEnabled(await getPropertyVivaConfig(id))] as const),
  );
  const payEnabledByBuilding = Object.fromEntries(gates);

  return <PaymentsTable rows={rows} payEnabledByBuilding={payEnabledByBuilding} title="Λογαριασμοί" />;
}
