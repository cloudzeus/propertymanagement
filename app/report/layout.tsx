import Link from "next/link";
import { redirect } from "next/navigation";
import { getEffectiveSession } from "@/lib/auth-effective";
import { homePathForRole } from "@/lib/surfaces";
import type { UserRole } from "@/lib/prisma/enums";

/**
 * Minimal, phone-first shell for the shared fault-report page: no sidebar,
 * just a slim top bar. Any signed-in role may use it (staff, suppliers,
 * managers, owners, residents); building access is enforced by the action.
 */
export default async function ReportLayout({ children }: { children: React.ReactNode }) {
  const eff = await getEffectiveSession();
  if (!eff) redirect("/login?next=/report");
  const home = homePathForRole(eff.user.role as UserRole);
  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg-canvas)" }}>
      <header style={{ position: "sticky", top: 0, zIndex: 10, display: "flex", alignItems: "center", gap: 10, height: 52, padding: "0 14px", background: "var(--card)", borderBottom: "1px solid var(--border)" }}>
        <Link href={home} style={{ fontSize: "var(--fs-13)", color: "var(--muted-foreground)", textDecoration: "none" }}>← Πίσω</Link>
        <span style={{ flex: 1, textAlign: "center", fontSize: "var(--fs-14)", fontWeight: 700, color: "var(--foreground)" }}>Δήλωση βλάβης</span>
        <span style={{ fontSize: "var(--fs-12)", color: "var(--muted-foreground)", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{eff.user.name ?? eff.user.email}</span>
      </header>
      <main style={{ padding: "16px 14px 40px" }}>{children}</main>
    </div>
  );
}
