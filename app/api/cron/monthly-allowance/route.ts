import { runMonthlyAllowance } from "@/lib/wallet/allowance";

export async function POST(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  const result = await runMonthlyAllowance();
  return new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json" } });
}
