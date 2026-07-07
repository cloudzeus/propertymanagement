import { auth } from '@/auth';
import { db } from '@/lib/db';

function unauthorized() {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function getAdminCompanyId() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session?.user || (role !== 'ADMIN' && role !== 'SUPER_ADMIN')) return null;
  const me = await db.user.findUnique({
    where: { id: session.user.id as string },
    select: { companyId: true },
  });
  return me?.companyId ?? null;
}

export async function GET() {
  const companyId = await getAdminCompanyId();
  if (!companyId) return unauthorized();

  const customers = await db.customer.findMany({
    where: { companyId },
    select: { id: true, name: true, meteredPlan: true },
    orderBy: { name: 'asc' },
  });

  const out = customers.map((c) => ({
    id: c.id,
    name: c.name,
    meteredPlan: c.meteredPlan
      ? {
          monthlyAllowanceEur: Number(c.meteredPlan.monthlyAllowanceEur),
          rollover: c.meteredPlan.rollover,
          adminMarkupPercent: c.meteredPlan.adminMarkupPercent,
          active: c.meteredPlan.active,
        }
      : null,
  }));

  return Response.json({ customers: out });
}

export async function PUT(request: Request) {
  const companyId = await getAdminCompanyId();
  if (!companyId) return unauthorized();

  const b = await request.json();
  if (!b.customerId) {
    return new Response(JSON.stringify({ error: 'customerId required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Ensure the customer belongs to this admin's company (data isolation).
  const customer = await db.customer.findFirst({
    where: { id: b.customerId, companyId },
    select: { id: true },
  });
  if (!customer) {
    return new Response(JSON.stringify({ error: 'Customer not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const plan = await db.customerMeteredPlan.upsert({
    where: { customerId: b.customerId },
    create: {
      customerId: b.customerId,
      monthlyAllowanceEur: Number(b.monthlyAllowanceEur) || 0,
      rollover: !!b.rollover,
      adminMarkupPercent: Number(b.adminMarkupPercent) || 0,
      active: b.active !== false,
    },
    update: {
      monthlyAllowanceEur:
        b.monthlyAllowanceEur !== undefined ? Number(b.monthlyAllowanceEur) : undefined,
      rollover: typeof b.rollover === 'boolean' ? b.rollover : undefined,
      adminMarkupPercent:
        b.adminMarkupPercent !== undefined ? Number(b.adminMarkupPercent) : undefined,
      active: typeof b.active === 'boolean' ? b.active : undefined,
    },
  });

  return Response.json({
    plan: { ...plan, monthlyAllowanceEur: Number(plan.monthlyAllowanceEur) },
  });
}
