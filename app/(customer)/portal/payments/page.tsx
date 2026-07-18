import { redirect } from "next/navigation";
import { getEffectiveSession } from "@/lib/auth-effective";
import { db } from "@/lib/db";
import { type AllocRow } from "@/lib/dashboard/alloc-view";
import { PaymentsView } from "@/components/dashboard/payments-view";

export const metadata = { title: "Πληρωμές" };

export default async function PortalPaymentsPage() {
  const eff = await getEffectiveSession();
  if (!eff?.user?.id) redirect("/login");
  const userId = eff.user.id;

  const allocs = await db.expenseAllocation.findMany({
    where: { unit: { residentId: userId } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, tenantAmount: true, tenantPaid: true,
      unit: { select: { unitNumber: true, building: { select: { name: true } } } },
      expense: { select: { month: true, description: true, receiptFile: { select: { url: true } } } },
    },
  });
  const rows: AllocRow[] = allocs.map((a) => ({
    id: a.id, month: a.expense.month,
    unitLabel: `${a.unit.building.name} · ${a.unit.unitNumber}`,
    description: a.expense.description,
    amount: Number(a.tenantAmount), paid: a.tenantPaid,
    receiptUrl: a.expense.receiptFile?.url ?? null,
  }));

  return <PaymentsView rows={rows} title="Πληρωμές" />;
}
