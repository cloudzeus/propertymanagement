import "server-only";
import { cookies } from "next/headers";
import type { UserRole } from "@/lib/prisma/enums";

export const IMPERSONATION_COOKIE = "impersonation";

export interface Impersonation {
  actorId: string;
  targetUserId: string;
  targetRole: UserRole;
}

export function serializeImpersonation(value: Impersonation): string {
  return JSON.stringify(value);
}

export function parseImpersonation(raw: string | undefined | null): Impersonation | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (v && typeof v.actorId === "string" && typeof v.targetUserId === "string" && typeof v.targetRole === "string") {
      return { actorId: v.actorId, targetUserId: v.targetUserId, targetRole: v.targetRole };
    }
    return null;
  } catch {
    return null;
  }
}

export async function readImpersonation(): Promise<Impersonation | null> {
  const store = await cookies();
  return parseImpersonation(store.get(IMPERSONATION_COOKIE)?.value);
}

export async function writeImpersonation(value: Impersonation): Promise<void> {
  const store = await cookies();
  store.set(IMPERSONATION_COOKIE, serializeImpersonation(value), {
    httpOnly: true, sameSite: "lax", secure: true, path: "/",
  });
}

export async function clearImpersonation(): Promise<void> {
  const store = await cookies();
  store.delete(IMPERSONATION_COOKIE);
}
