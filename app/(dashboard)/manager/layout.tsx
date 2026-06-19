import { AppShell } from "@/components/admin/app-shell";

export const metadata = {
  title: "Manager — PropertyPro",
};

export default function ManagerLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell allowedRoles={["SUPER_ADMIN", "ADMIN", "MANAGER", "PROPERTY_ADMIN"]}>
      {children}
    </AppShell>
  );
}
