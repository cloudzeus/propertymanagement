import { requirePermission } from "@/lib/rbac/permissions";
import { db } from "@/lib/db";
import { startImpersonation } from "@/app/actions/impersonation";

export const metadata = { title: "View as — PropertyPro" };

export default async function ViewAsPage() {
  await requirePermission("view-as", "view");
  const users = await db.user.findMany({
    where: { role: { not: "SUPER_ADMIN" } },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { role: "asc" },
    take: 200,
  });

  return (
    <div className="dash-page" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: "var(--fs-22)", fontWeight: 700, color: "var(--foreground)" }}>Προεπισκόπηση ως χρήστης</h1>
        <p style={{ margin: "4px 0 0", color: "var(--muted-foreground)", fontSize: "var(--fs-13)" }}>Διάλεξε χρήστη για να δεις την εφαρμογή με τα δεδομένα του. Έξοδος από το banner.</p>
      </div>
      <ul className="divide-y" style={{ listStyle: "none", margin: 0, padding: "4px 18px", maxWidth: 860, background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-ghost)" }}>
        {users.map((u) => (
          <li key={u.id} className="flex items-center justify-between py-3">
            <span>{u.name ?? u.email} <span className="text-[var(--muted-foreground)]">· {u.role}</span></span>
            <form action={startImpersonation.bind(null, u.id)}>
              <button type="submit" className="min-h-9 px-3 py-1 text-[var(--color-info)] border border-[var(--color-info)] rounded-lg hover:bg-[var(--info-soft)]">View as</button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
