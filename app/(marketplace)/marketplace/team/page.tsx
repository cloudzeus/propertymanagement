import { notFound } from "next/navigation";
import { can } from "@/lib/rbac/permissions";
import { requireCollaborator } from "@/lib/marketplace";
import { UnlinkedNotice } from "@/components/marketplace/UnlinkedNotice";
import { loadSupplierFull } from "@/lib/suppliers";
import { TeamEditor } from "@/components/suppliers/TeamEditor";
import { RiGroupLine } from "react-icons/ri";

export const metadata = { title: "Ομάδα" };

export default async function SupplierTeamPage() {
  const ctx = await requireCollaborator("mkt-team");
  if (!ctx.supplierId) return <UnlinkedNotice />;
  const full = await loadSupplierFull(ctx.supplierId);
  if (!full) notFound();
  const canEdit = ctx.isSupplierAdmin && can(ctx.perms, "mkt-team", "edit");

  return (
    <div className="dash-page" style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 1000 }}>
      <div>
        <h1 style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 22, fontWeight: 700, color: "var(--foreground)", margin: 0 }}><RiGroupLine style={{ color: "var(--color-primary)" }} /> Ομάδα</h1>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted-foreground)" }}>
          Οι λογαριασμοί της επιχείρησής σας. Οι τεχνικοί βλέπουν τις αναθέσεις· οι διαχειριστές επεξεργάζονται επιπλέον προφίλ, κατάλογο και ομάδα.
        </p>
      </div>
      <TeamEditor supplierId={full.supplier.id} users={full.users} canEdit={canEdit} selfId={ctx.userId} />
    </div>
  );
}
