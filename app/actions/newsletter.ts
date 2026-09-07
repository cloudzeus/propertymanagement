"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/rbac/permissions";

/** Admin: manual opt-out (e.g. request by phone). Keeps the row as proof. */
export async function adminUnsubscribe(id: string) {
  await requirePermission("cms-newsletter", "edit");
  await db.newsletterSubscriber.update({ where: { id }, data: { status: "UNSUBSCRIBED", unsubscribedAt: new Date() } });
  revalidatePath("/super-admin/cms/newsletter");
  return { ok: true };
}

/** Admin: GDPR erasure — removes the subscriber entirely. */
export async function adminEraseSubscriber(id: string) {
  await requirePermission("cms-newsletter", "delete");
  await db.newsletterSubscriber.delete({ where: { id } });
  revalidatePath("/super-admin/cms/newsletter");
  return { ok: true };
}

/** Admin: GDPR erasure of a contact-form message. */
export async function adminEraseContactMessage(id: string) {
  await requirePermission("cms-newsletter", "delete");
  await db.contactMessage.delete({ where: { id } });
  revalidatePath("/super-admin/cms/newsletter");
  return { ok: true };
}

export async function adminSetContactStatus(id: string, status: "NEW" | "READ" | "RESPONDED" | "SPAM") {
  await requirePermission("cms-newsletter", "edit");
  await db.contactMessage.update({ where: { id }, data: { status } });
  revalidatePath("/super-admin/cms/newsletter");
  return { ok: true };
}
