import { AppShell } from "@/components/admin/app-shell";
import { SURFACE_ROLES } from "@/lib/surfaces";

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return <AppShell allowedRoles={[...SURFACE_ROLES.customer]}>{children}</AppShell>;
}
