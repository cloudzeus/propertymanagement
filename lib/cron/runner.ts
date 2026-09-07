import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/prisma/client";
import { CRON_JOBS, type CronJob } from "./jobs";

const TZ = "Europe/Athens";

/** Local (Athens) calendar parts of a date. */
function athens(d: Date): { y: number; m: number; day: number; hour: number } {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { y: get("year"), m: get("month"), day: get("day"), hour: get("hour") % 24 };
}

/** Run one job, recording a CronRun row. Concurrent runs of the same job are skipped. */
export async function runJob(job: CronJob, trigger: "scheduler" | "http" | "manual"): Promise<{ id: string; ok: boolean; result?: Record<string, unknown>; error?: string }> {
  const running = await db.cronRun.findFirst({ where: { job: job.key, finishedAt: null, startedAt: { gte: new Date(Date.now() - 30 * 60_000) } }, select: { id: true } });
  if (running) return { id: running.id, ok: false, error: "already running" };
  const row = await db.cronRun.create({ data: { job: job.key, trigger } });
  try {
    const result = await job.run();
    await db.cronRun.update({ where: { id: row.id }, data: { finishedAt: new Date(), ok: true, result: result as Prisma.InputJsonValue } });
    return { id: row.id, ok: true, result };
  } catch (e) {
    const error = e instanceof Error ? `${e.message}\n${e.stack ?? ""}`.slice(0, 4000) : String(e);
    await db.cronRun.update({ where: { id: row.id }, data: { finishedAt: new Date(), ok: false, error } });
    console.error(`[cron] ${job.key} failed`, e);
    return { id: row.id, ok: false, error };
  }
}

export function findJob(key: string): CronJob | undefined {
  return CRON_JOBS.find((j) => j.key === key);
}

/** Is the job due now, given its schedule and its last successful run? */
export function isDue(job: CronJob, lastOk: Date | null, now: Date): boolean {
  const n = athens(now);
  if (n.hour < job.schedule.hour) return false;
  if (job.schedule.kind === "monthly" && n.day !== 1) return false;
  if (!lastOk) return true;
  const l = athens(lastOk);
  if (job.schedule.kind === "daily") return l.y !== n.y || l.m !== n.m || l.day !== n.day;
  return l.y !== n.y || l.m !== n.m;
}

/** Called by the scheduler tick: runs every job that is due. */
export async function runDueJobs(now = new Date()): Promise<string[]> {
  const ran: string[] = [];
  for (const job of CRON_JOBS) {
    const last = await db.cronRun.findFirst({ where: { job: job.key, ok: true }, orderBy: { startedAt: "desc" }, select: { startedAt: true } });
    if (!isDue(job, last?.startedAt ?? null, now)) continue;
    const r = await runJob(job, "scheduler");
    if (r.ok) ran.push(job.key);
  }
  return ran;
}

/** Last runs per job for the settings page. */
export async function cronStatus() {
  const rows = await db.cronRun.findMany({ orderBy: { startedAt: "desc" }, take: 60 });
  return CRON_JOBS.map((j) => ({
    key: j.key, label: j.label, description: j.description, schedule: j.schedule,
    runs: rows.filter((r) => r.job === j.key).slice(0, 5).map((r) => ({ id: r.id, trigger: r.trigger, startedAt: r.startedAt.toISOString(), finishedAt: r.finishedAt?.toISOString() ?? null, ok: r.ok, result: r.result as Record<string, unknown> | null, error: r.error })),
  }));
}
