import { auth } from '@/auth';
import { db } from '@/lib/db';
import { DEFAULT_API_COSTS, getConfig, getBilledCost } from '@/lib/api-costs';

export async function GET(request: Request) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session?.user || (role !== 'ADMIN' && role !== 'SUPER_ADMIN')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const me = await db.user.findUnique({
    where: { id: session.user.id as string },
    select: { companyId: true },
  });
  const companyId = me?.companyId;

  const url = new URL(request.url);
  const days = parseInt(url.searchParams.get('days') || '30', 10);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const apiNames = Object.keys(DEFAULT_API_COSTS);
  const breakdown = await Promise.all(
    apiNames.map(async (apiName) => {
      const logs = await db.aPIUsageLog.findMany({
        where: { apiName, status: 'SUCCESS', createdAt: { gte: startDate }, ...(companyId ? { companyId } : {}) },
        select: { totalCost: true },
      });
      const realCost = logs.reduce((sum, l) => sum + l.totalCost, 0);
      const cfg = await getConfig(apiName);
      const billedCost = getBilledCost(realCost, cfg?.markupPercent ?? 0);
      return {
        apiName,
        displayName: cfg?.displayName ?? apiName,
        billedCost: parseFloat(billedCost.toFixed(2)),
      };
    })
  );

  const billedTotal = breakdown.reduce((sum, b) => sum + b.billedCost, 0);

  return new Response(JSON.stringify({
    period: `Last ${days} days`,
    billedTotal: parseFloat(billedTotal.toFixed(2)),
    breakdown,
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
