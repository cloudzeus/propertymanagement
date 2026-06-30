"use server";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import type { UserRole } from "@/lib/prisma/enums";
import { writeImpersonation, clearImpersonation, readImpersonation } from "@/lib/impersonation";
import { homePathForRole } from "@/lib/surfaces";

export async function startImpersonation(targetUserId: string): Promise<void> {
  const session = await auth();
  const actorId = (session?.user as any)?.id as string | undefined;
  const actorRole = (session?.user as any)?.role as UserRole | undefined;
  if (!actorId || actorRole !== "SUPER_ADMIN") throw new Error("Forbidden");

  const target = await db.user.findUnique({ where: { id: targetUserId } });
  if (!target) throw new Error("Target user not found");

  await writeImpersonation({ actorId, targetUserId: target.id, targetRole: target.role as UserRole });
  await db.impersonationEvent.create({
    data: { actorId, targetUserId: target.id, targetRole: target.role as UserRole, action: "START" },
  });
  redirect(homePathForRole(target.role as UserRole));
}

export async function stopImpersonation(): Promise<void> {
  const imp = await readImpersonation();
  if (imp) {
    await db.impersonationEvent.create({
      data: { actorId: imp.actorId, targetUserId: imp.targetUserId, targetRole: imp.targetRole, action: "STOP" },
    });
  }
  await clearImpersonation();
  redirect("/super-admin");
}
