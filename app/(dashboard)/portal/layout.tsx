import { AppShell } from "@/components/admin/app-shell";

export const metadata = {
  title: "Πύλη Ενοικιαστή — PropertyPro",
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell allowedRoles={["SUPER_ADMIN", "ADMIN", "PROPERTY_RESIDENT", "PROPERTY_VIEWER"]}>
      {children}
    </AppShell>
  );
}
