import { requirePermission } from "@/lib/rbac/permissions";

// The costs page itself is a client component, so its RBAC guard lives here in a
// server layout that gates the whole /super-admin/settings/costs subtree.
export default async function CostsLayout({ children }: { children: React.ReactNode }) {
  await requirePermission("api-costs", "view");
  return <>{children}</>;
}
