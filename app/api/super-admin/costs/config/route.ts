import { auth } from '@/auth';
import { db } from '@/lib/db';
import { DEFAULT_API_COSTS, initializeAPICostConfigs, mergeConfig } from '@/lib/api-costs';

function unauthorized() {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function GET() {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== 'SUPER_ADMIN') return unauthorized();

  const existing = await db.aPICostConfig.findMany();
  if (existing.length === 0) {
    await initializeAPICostConfigs();
  }
  const rows = await db.aPICostConfig.findMany({ orderBy: { displayName: 'asc' } });

  // Ensure every known default API appears even if seeding is partial.
  const byName = new Map(rows.map((r) => [r.apiName, r]));
  const configs = Object.keys(DEFAULT_API_COSTS).map((apiName) => {
    const row = byName.get(apiName) ?? null;
    const merged = mergeConfig(apiName, row);
    return {
      ...merged,
      monthlyBudgetLimit: row?.monthlyBudgetLimit ?? null,
      enabled: row?.enabled ?? true,
    };
  });

  return new Response(JSON.stringify({ configs }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== 'SUPER_ADMIN') return unauthorized();

  const body = await request.json();
  const apiName: string = body.apiName;
  const base = DEFAULT_API_COSTS[apiName as keyof typeof DEFAULT_API_COSTS];
  if (!apiName || !base) {
    return new Response(JSON.stringify({ error: 'Unknown apiName' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const num = (v: unknown, fallback: number) => {
    const n = typeof v === 'number' ? v : parseFloat(String(v));
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };

  const basePrice = num(body.basePrice, base.basePrice);
  const freeQuota = Math.round(num(body.freeQuota, base.freeQuota));
  const markupPercent = num(body.markupPercent, 0);
  const monthlyBudgetLimit =
    body.monthlyBudgetLimit == null || body.monthlyBudgetLimit === ''
      ? null
      : num(body.monthlyBudgetLimit, 0);
  const enabled = body.enabled !== false;

  const updated = await db.aPICostConfig.upsert({
    where: { apiName },
    update: { basePrice, freeQuota, markupPercent, monthlyBudgetLimit, enabled, updatedBy: session.user.id as string },
    create: {
      apiName,
      displayName: base.displayName,
      costModel: base.costModel,
      basePrice,
      freeQuota,
      markupPercent,
      monthlyBudgetLimit,
      enabled,
      quotaResetDay: base.quotaResetDay,
      documentationUrl: base.documentationUrl,
      updatedBy: session.user.id as string,
    },
  });

  return new Response(JSON.stringify({ config: updated }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
