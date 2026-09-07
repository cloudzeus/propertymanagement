import { requirePermission } from "@/lib/rbac/permissions";
import { cronStatus } from "@/lib/cron/runner";
import { CronClient } from "./CronClient";

export const metadata = { title: "Αυτόματες εργασίες" };

export default async function CronSettingsPage() {
  await requirePermission("settings", "view");
  const jobs = await cronStatus();
  const flag = process.env.CRON_IN_PROCESS;
  const enabled = flag === "true" || (flag !== "false" && process.env.NODE_ENV === "production");
  return <CronClient jobs={jobs} schedulerEnabled={enabled} />;
}
