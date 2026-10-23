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
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-semibold mb-4">Προεπισκόπηση ως χρήστης</h1>
      <p className="text-[var(--muted-foreground)] mb-6">Διάλεξε χρήστη για να δεις την εφαρμογή με τα δεδομένα του. Έξοδος από το banner.</p>
      <ul className="divide-y">
        {users.map((u) => (
          <li key={u.id} className="flex items-center justify-between py-3">
            <span>{u.name ?? u.email} <span className="text-[var(--muted-foreground)]">· {u.role}</span></span>
            <form action={startImpersonation.bind(null, u.id)}>
              <button type="submit" className="px-3 py-1 text-[var(--color-info)] border border-blue-600 rounded hover:bg-[var(--info-soft)]">View as</button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
