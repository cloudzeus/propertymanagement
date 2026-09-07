// External trigger (optional — the in-process scheduler runs this daily):
// curl -H "x-cron-secret: $CRON_SECRET" https://property.dgsmart.gr/api/cron/maintenance-reminders
import { NextResponse } from "next/server";
import { findJob, runJob } from "@/lib/cron/runner";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("x-cron-secret") !== secret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const r = await runJob(findJob("maintenance-reminders")!, "http");
  return NextResponse.json(r, { status: r.ok ? 200 : 500 });
}
