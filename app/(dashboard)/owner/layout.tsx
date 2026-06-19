import { AppShell } from "@/components/admin/app-shell";

export const metadata = {
  title: "Ιδιοκτήτης — PropertyPro",
};

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell allowedRoles={["SUPER_ADMIN", "ADMIN", "PROPERTY_OWNER"]}>
      {children}
    </AppShell>
  );
}
