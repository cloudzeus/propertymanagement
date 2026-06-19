import { auth } from '@/auth';
import { getAllAPICosts } from '@/lib/api-costs';

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
  const days = parseInt(url.searchParams.get('days') || '30', 10);

  const costs = await getAllAPICosts(days);

  return new Response(JSON.stringify(costs), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
