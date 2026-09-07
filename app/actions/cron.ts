"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/rbac/permissions";
import { findJob, runJob } from "@/lib/cron/runner";

/** Super admin: run a scheduled job right now (recorded as trigger "manual"). */
export async function runCronJobNow(key: string) {
  await requirePermission("settings", "edit");
  const job = findJob(key);
  if (!job) return { error: "Άγνωστη εργασία" };
  const r = await runJob(job, "manual");
  revalidatePath("/super-admin/settings/cron");
  return r.ok ? { ok: true, result: r.result } : { error: r.error ?? "Αποτυχία" };
}
