import "server-only";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import type { UserRole } from "@/lib/prisma/enums";
import { readImpersonation } from "@/lib/impersonation";

export interface EffectiveSession {
  user: { id: string; role: UserRole; roleId: string | null; companyId: string | null; customerId: string | null; name: string | null; email: string };
  real: { id: string; role: UserRole };
  impersonatorId: string | null;
}

export async function getEffectiveSession(): Promise<EffectiveSession | null> {
  const session = await auth();
  if (!session?.user) return null;
  const realId = (session.user as any).id as string;
  const realRole = (session.user as any).role as UserRole;

  if (realRole === "SUPER_ADMIN") {
    const imp = await readImpersonation();
    if (imp && imp.actorId === realId) {
      const target = await db.user.findUnique({ where: { id: imp.targetUserId } });
      if (target) {
        return {
          user: { id: target.id, role: target.role as UserRole, roleId: target.roleId ?? null, companyId: target.companyId ?? null, customerId: target.customerId ?? null, name: target.name, email: target.email },
          real: { id: realId, role: realRole },
          impersonatorId: realId,
        };
      }
    }
  }

  return {
    user: { id: realId, role: realRole, roleId: (session.user as any).roleId ?? null, companyId: (session.user as any).companyId ?? null, customerId: (session.user as any).customerId ?? null, name: session.user.name ?? null, email: session.user.email ?? "" },
    real: { id: realId, role: realRole },
    impersonatorId: null,
  };
}
