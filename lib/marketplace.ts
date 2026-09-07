import "server-only";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getEffectivePermissions, can } from "@/lib/rbac/permissions";
import type { RbacAction } from "@/lib/rbac/types";

export type CollaboratorContext = {
  userId: string;
  userName: string | null;
  supplierId: string | null;
  supplierName: string | null;
  isSupplierAdmin: boolean;
  onboarded: boolean;
  perms: Set<string>;
};

/**
 * Guard for /marketplace pages: the effective user must be a COLLABORATOR
 * (or a super-admin viewing-as one) holding `moduleKey:action`. Returns the
 * supplier link so pages can scope every query to `supplierId`.
 *
 * First-login wizard: a supplier admin whose business has not completed
 * onboarding is sent to /marketplace/onboarding from every other page.
 */
export async function requireCollaborator(moduleKey: string, action: RbacAction = "view", opts: { allowUnonboarded?: boolean } = {}): Promise<CollaboratorContext> {
  const resolved = await getEffectivePermissions();
  if (!resolved) redirect("/login");
  if (resolved.role !== "COLLABORATOR" && resolved.role !== "SUPER_ADMIN") redirect("/unauthorized");
  if (!can(resolved.perms, moduleKey, action)) redirect("/unauthorized");

  const { getEffectiveSession } = await import("@/lib/auth-effective");
  const eff = await getEffectiveSession();
  if (!eff) redirect("/login");
  const u = await db.user.findUnique({
    where: { id: eff.user.id },
    select: { name: true, supplierId: true, isSupplierAdmin: true, supplier: { select: { name: true, onboardedAt: true } } },
  });
  const onboarded = !!u?.supplier?.onboardedAt;
  if (u?.supplierId && u.isSupplierAdmin && !onboarded && !opts.allowUnonboarded) redirect("/marketplace/onboarding");
  return {
    userId: eff.user.id,
    userName: u?.name ?? null,
    supplierId: u?.supplierId ?? null,
    supplierName: u?.supplier?.name ?? null,
    isSupplierAdmin: u?.isSupplierAdmin ?? false,
    onboarded,
    perms: resolved.perms,
  };
}
