import { AppShell } from "@/components/admin/app-shell";
import { SURFACE_ROLES } from "@/lib/surfaces";

export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  return <AppShell allowedRoles={[...SURFACE_ROLES.marketplace]}>{children}</AppShell>;
}
