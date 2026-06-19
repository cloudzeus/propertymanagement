import { auth } from '@/auth';
import { getMonthlyCosts } from '@/lib/api-costs';

export async function GET(request: Request) {
  const session = await auth();

  // Verify SUPER_ADMIN access
  if (!session?.user || session.user.role !== 'SUPER_ADMIN') {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const year = parseInt(url.searchParams.get('year') || new Date().getFullYear().toString(), 10);
  const month = parseInt(url.searchParams.get('month') || (new Date().getMonth() + 1).toString(), 10);

  const costs = await getMonthlyCosts(year, month);

  return new Response(JSON.stringify(costs), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
