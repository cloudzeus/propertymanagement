import { AppShell } from "@/components/admin/app-shell";

export const metadata = {
  title: "Admin — PropertyPro",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell allowedRoles={["SUPER_ADMIN", "ADMIN"]}>
      {children}
    </AppShell>
  );
}
