import { auth } from '@/auth';
import { db } from '@/lib/db';
import { creditWallet } from '@/lib/wallet/ledger';

function unauthorized() {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function getAdminSession() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session?.user || (role !== 'ADMIN' && role !== 'SUPER_ADMIN')) return null;
  const userId = session.user.id as string;
  const me = await db.user.findUnique({
    where: { id: userId },
    select: { companyId: true },
  });
  if (!me?.companyId) return null;
  return { userId, companyId: me.companyId };
}

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) return unauthorized();

  const customers = await db.customer.findMany({
    where: { companyId: admin.companyId },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  const customerIds = customers.map((c) => c.id);

  // Only wallets whose ownerId belongs to THIS company's customers (isolation).
  const wallets = await db.wallet.findMany({
    where: { ownerType: 'CUSTOMER', ownerId: { in: customerIds } },
  });
  const byOwner = new Map(wallets.map((w) => [w.ownerId, w]));

  const rows = customers.map((c) => {
    const w = byOwner.get(c.id);
    return {
      id: c.id,
      name: c.name,
      balanceEur: Number(w?.balanceEur ?? 0),
      lowBalanceEur: w?.lowBalanceEur != null ? Number(w.lowBalanceEur) : null,
    };
  });

  return Response.json({ rows });
}

export async function POST(request: Request) {
  const admin = await getAdminSession();
  if (!admin) return unauthorized();

  const b = await request.json();
  const amountEur = Number(b.amountEur);
  if (!b.customerId || !Number.isFinite(amountEur) || amountEur === 0) {
    return new Response(JSON.stringify({ error: 'Invalid amount' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Ensure the customer belongs to this admin's company (data isolation) BEFORE crediting.
  const customer = await db.customer.findFirst({
    where: { id: b.customerId, companyId: admin.companyId },
    select: { id: true },
  });
  if (!customer) {
    return new Response(JSON.stringify({ error: 'Customer not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const result = await creditWallet({
    ownerType: 'CUSTOMER',
    ownerId: b.customerId,
    type: 'ADJUSTMENT',
    amountEur,
    description: b.description || 'Manual adjustment',
    refType: 'manual',
    createdById: admin.userId,
  });

  return Response.json({ balanceAfter: result.balanceAfter });
}
