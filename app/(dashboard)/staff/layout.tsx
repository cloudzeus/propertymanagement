import { AppShell } from "@/components/admin/app-shell";

export const metadata = {
  title: "Προσωπικό — PropertyPro",
};

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell allowedRoles={["SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE", "COLLABORATOR"]}>
      {children}
    </AppShell>
  );
}
