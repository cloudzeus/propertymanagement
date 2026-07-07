import { auth } from "@/auth";
import { db } from "@/lib/db";
import { creditWallet } from "@/lib/wallet/ledger";
import { COMPANY_WALLET_ID } from "@/lib/wallet/metering";

async function requireSuperAdmin() {
  const session = await auth();
  return session?.user && (session.user as any).role === "SUPER_ADMIN" ? session : null;
}

const forbidden = () =>
  new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  });

export async function GET() {
  if (!(await requireSuperAdmin())) return forbidden();
  const wallet = await db.wallet.findUnique({
    where: { ownerType_ownerId: { ownerType: "COMPANY", ownerId: COMPANY_WALLET_ID } },
  });
  const ledger = wallet
    ? await db.walletTransaction.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: "desc" },
        take: 100,
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
    lowBalanceEur: wallet?.lowBalanceEur != null ? Number(wallet.lowBalanceEur) : null,
    ledger: ledgerOut,
  });
}

export async function POST(request: Request) {
  const session = await requireSuperAdmin();
  if (!session) return forbidden();
  const b = await request.json();
  const amount = Number(b.amountEur);
  if (!Number.isFinite(amount) || amount <= 0) {
    return new Response(JSON.stringify({ error: "amountEur must be > 0" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const res = await creditWallet({
    ownerType: "COMPANY",
    ownerId: COMPANY_WALLET_ID,
    type: "TOPUP",
    amountEur: amount,
    description: b.description || "Wholesale credit purchase",
    refType: "manual",
    createdById: (session.user as any).id,
  });
  return Response.json({ balanceAfter: res.balanceAfter });
}
