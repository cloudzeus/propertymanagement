import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { BillingClient } from "./BillingClient";

export const metadata = { title: "Τιμολόγηση — Super Admin" };

export default async function BillingPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const me = await db.user.findUnique({ where: { id: session.user.id as string }, select: { role: true } });
  if (me?.role !== "SUPER_ADMIN") redirect("/admin");

  const invoices = await db.serviceInvoice.findMany({
    orderBy: [{ period: "desc" }, { issuedAt: "desc" }],
    include: { customer: { select: { name: true } } },
  });

  const rows = invoices.map((i) => ({
    id: i.id,
    customerName: i.customer.name,
    period: i.period,
    amount: Number(i.amount),
    status: i.status,
    issuedAt: i.issuedAt.toISOString(),
    dueDate: i.dueDate ? i.dueDate.toISOString() : null,
    paidAt: i.paidAt ? i.paidAt.toISOString() : null,
  }));

  const paid = rows.filter((r) => r.status === "PAID");
  const pending = rows.filter((r) => r.status === "PENDING" || r.status === "OVERDUE");
  const stats = {
    total: rows.length,
    paid: paid.length,
    pending: pending.length,
    totalAmount: rows.reduce((s, r) => s + r.amount, 0),
    pendingAmount: pending.reduce((s, r) => s + r.amount, 0),
  };

  return <BillingClient rows={rows} stats={stats} />;
}
