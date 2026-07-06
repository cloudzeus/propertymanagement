import { redirect } from "next/navigation";
import { getAppSettings } from "@/lib/app-settings";
import { signOutAction } from "@/app/actions/sign-out";
import { SidebarNav } from "./sidebar-nav";
import { GlobalExpenseButton } from "@/components/buildings/GlobalExpenseButton";
import { listManageableBuildings } from "@/app/actions/building-expenses";
import { getEffectiveSession } from "@/lib/auth-effective";
import { ImpersonationBanner } from "./impersonation-banner";
import { getEffectivePermissions, buildMenu } from "@/lib/rbac/permissions";

const EXPENSE_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER", "PROPERTY_ADMIN"];

type UserRole =
  | "SUPER_ADMIN" | "ADMIN" | "MANAGER" | "EMPLOYEE"
  | "PROPERTY_ADMIN" | "PROPERTY_OWNER" | "PROPERTY_RESIDENT"
  | "PROPERTY_VIEWER" | "COLLABORATOR";

type Props = {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
};

export async function AppShell({ children, allowedRoles }: Props) {
  const eff = await getEffectiveSession();

  if (!eff) redirect("/login");

  const role = eff.user.role;

  if (allowedRoles && !allowedRoles.includes(role)) {
    redirect("/unauthorized");
  }

  const settings = await getAppSettings();
  const expenseBuildings = EXPENSE_ROLES.includes(role) ? await listManageableBuildings() : [];

  const resolved = await getEffectivePermissions();
  const menu = resolved ? buildMenu(resolved.surface, resolved.perms) : [];

  return (
    <div style={{
      display: "flex",
      height: "100vh",
      overflow: "hidden",
      background: "var(--bg-canvas)",
      fontFamily: "var(--font-sans)",
    }}>
      <SidebarNav
        role={role}
        menu={menu}
        userName={eff.user.name ?? ""}
        userEmail={eff.user.email ?? ""}
        logoUrl={settings.logoFullLight ?? settings.logoUrl}
        logoSquareUrl={settings.logoSquareLight ?? settings.logoSquareUrl}
        companyName={settings.companyName}
        onSignOut={signOutAction}
      />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
        {eff.impersonatorId && <ImpersonationBanner name={eff.user.name ?? eff.user.email ?? ""} role={role} />}
        <main style={{ flex: 1, overflowY: "auto", padding: 28, minWidth: 0 }}>
          {children}
        </main>
      </div>

      {expenseBuildings.length > 0 && <GlobalExpenseButton buildings={expenseBuildings} />}
    </div>
  );
}
