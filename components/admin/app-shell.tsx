import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getAppSettings } from "@/lib/app-settings";
import { signOutAction } from "@/app/actions/sign-out";
import { SidebarNav } from "./sidebar-nav";

type UserRole =
  | "SUPER_ADMIN" | "ADMIN" | "MANAGER" | "EMPLOYEE"
  | "PROPERTY_ADMIN" | "PROPERTY_OWNER" | "PROPERTY_RESIDENT"
  | "PROPERTY_VIEWER" | "COLLABORATOR";

type Props = {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
};

export async function AppShell({ children, allowedRoles }: Props) {
  const session = await auth();

  if (!session?.user) redirect("/login");

  const role = session.user.role as UserRole;

  if (allowedRoles && !allowedRoles.includes(role)) {
    redirect("/unauthorized");
  }

  const settings = await getAppSettings();

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
        userName={session.user.name ?? ""}
        userEmail={session.user.email ?? ""}
        logoUrl={settings.logoUrl}
        logoSquareUrl={settings.logoSquareUrl}
        companyName={settings.companyName}
        onSignOut={signOutAction}
      />

      <main style={{ flex: 1, overflowY: "auto", padding: 28, minWidth: 0 }}>
        {children}
      </main>
    </div>
  );
}
