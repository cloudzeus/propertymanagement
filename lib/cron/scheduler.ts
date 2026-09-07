import "server-only";
import { runDueJobs } from "./runner";

const TICK_MS = 5 * 60_000;
const g = globalThis as unknown as { __cronScheduler?: NodeJS.Timeout };

/**
 * In-process scheduler (no external cron needed). Started once per server
 * process from instrumentation.ts; ticks every 5 minutes and runs whatever
 * `runDueJobs` says is due. The CronRun table makes it safe across restarts
 * (a job runs at most once per day/month) — single-instance deployment.
 *
 * Enabled in production, or anywhere with CRON_IN_PROCESS=true. Set
 * CRON_IN_PROCESS=false to disable (e.g. when an external cron is used).
 */
export function startCronScheduler(): void {
  const flag = process.env.CRON_IN_PROCESS;
  const enabled = flag === "true" || (flag !== "false" && process.env.NODE_ENV === "production");
  if (!enabled || g.__cronScheduler) return;
  const tick = async () => {
    try {
      const ran = await runDueJobs();
      if (ran.length) console.info(`[cron] ran: ${ran.join(", ")}`);
    } catch (e) {
      console.error("[cron] tick failed", e);
    }
  };
  g.__cronScheduler = setInterval(tick, TICK_MS);
  g.__cronScheduler.unref?.();
  setTimeout(tick, 20_000).unref?.(); // first pass shortly after boot
  console.info("[cron] in-process scheduler started (tick every 5 min)");
}
