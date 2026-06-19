import { AppShell } from "@/components/admin/app-shell";

export const metadata = {
  title: "Super Admin — PropertyPro",
};

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell allowedRoles={["SUPER_ADMIN"]}>
      {children}
    </AppShell>
  );
}
