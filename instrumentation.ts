/**
 * Next.js instrumentation hook — runs once when the Node server starts.
 * Boots the in-process cron scheduler (lib/cron) so scheduled jobs need no
 * external trigger (Coolify/crontab). See lib/cron/scheduler.ts for the flags.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startCronScheduler } = await import("./lib/cron/scheduler");
    startCronScheduler();
  }
}
