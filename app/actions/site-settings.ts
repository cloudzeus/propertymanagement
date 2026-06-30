"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";

async function requireSuperAdmin() {
  const s = await auth();
  if ((s?.user as any)?.role !== "SUPER_ADMIN") throw new Error("Forbidden");
}

export async function updateSiteSettings(data: Record<string, unknown>): Promise<void> {
  await requireSuperAdmin();
  await db.siteSettings.upsert({
    where: { id: "singleton" },
    update: data as any,
    create: { id: "singleton", ...(data as any) },
  });
  revalidatePath("/");
  revalidatePath("/super-admin/cms/settings");
}
