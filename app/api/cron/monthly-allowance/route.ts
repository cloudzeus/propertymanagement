// External trigger (optional — the in-process scheduler runs this on the 1st of each month).
import { findJob, runJob } from "@/lib/cron/runner";

export async function POST(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  const r = await runJob(findJob("monthly-allowance")!, "http");
  return new Response(JSON.stringify(r), { status: r.ok ? 200 : 500, headers: { "Content-Type": "application/json" } });
}
