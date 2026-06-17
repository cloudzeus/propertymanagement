"use client";

import { useSession } from "next-auth/react";
import { UserRole } from "@prisma/client";
import { hasPermission, Permission } from "@/lib/roles";

export function useAuth() {
  const { data: session, status } = useSession();

  return {
    user: session?.user,
    isLoading: status === "loading",
    isAuthenticated: status === "authenticated",
  };
}

export function useRole() {
  const { data: session } = useSession();
  return (session?.user as any)?.role as UserRole | undefined;
}

export function usePermission(permission: Permission) {
  const role = useRole();
  if (!role) return false;
  return hasPermission(role, permission);
}

export function useIsRole(...roles: UserRole[]) {
  const role = useRole();
  return role && roles.includes(role);
}

export function useCompanyId() {
  const { data: session } = useSession();
  return (session?.user as any)?.companyId as string | undefined;
}
