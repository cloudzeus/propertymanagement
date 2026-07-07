import { db } from "@/lib/db";
import { currentCustomerId } from "@/lib/wallet/current-customer";

export async function GET() {
  // Customer is resolved strictly from the session — never from the request —
  // so a caller can only ever see their own wallet (data isolation boundary).
  const customerId = await currentCustomerId();
  if (!customerId) {
    return new Response(JSON.stringify({ error: "no_customer" }), {
      status: 403,
    });
  }

  const wallet = await db.wallet.findUnique({
    where: { ownerType_ownerId: { ownerType: "CUSTOMER", ownerId: customerId } },
  });
  const plan = await db.customerMeteredPlan.findUnique({ where: { customerId } });
  const ledger = wallet
    ? await db.walletTransaction.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: "desc" },
        take: 50,
      })
    : [];

  const ledgerOut = ledger.map((t) => ({
    id: t.id,
    type: t.type,
    amountEur: Number(t.amountEur),
    balanceAfter: Number(t.balanceAfter),
    description: t.description,
    createdAt: t.createdAt,
  }));

  return Response.json({
    balanceEur: wallet ? Number(wallet.balanceEur) : 0,
    monthlyAllowanceEur: plan ? Number(plan.monthlyAllowanceEur) : 0,
    ledger: ledgerOut,
  });
}
