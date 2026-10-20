import { notFound } from "next/navigation";
import { can } from "@/lib/rbac/permissions";
import { requireCollaborator } from "@/lib/marketplace";
import { UnlinkedNotice } from "@/components/marketplace/UnlinkedNotice";
import { loadSupplierFull } from "@/lib/suppliers";
import { ContactsEditor } from "@/components/suppliers/ContactsEditor";
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
        <h1 style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "var(--fs-22)", fontWeight: 700, color: "var(--foreground)", margin: 0 }}><RiGroupLine style={{ color: "var(--color-primary)" }} /> Ομάδα</h1>
        <p style={{ margin: "4px 0 0", fontSize: "var(--fs-13)", color: "var(--muted-foreground)" }}>
          Οι επαφές και οι λογαριασμοί της επιχείρησής σας. Οι τεχνικοί βλέπουν τις αναθέσεις· οι διαχειριστές επεξεργάζονται επιπλέον προφίλ, κατάλογο και ομάδα και υπογράφουν τις συμβάσεις. Νέος συνάδελφος: «Νέα επαφή» → «Πρόσκληση με link» — ορίζει μόνος του τον κωδικό.
        </p>
      </div>
      <ContactsEditor supplierId={full.supplier.id} contacts={full.contacts} canEdit={canEdit} selfUserId={ctx.userId} storageKey="marketplace-team" />
    </div>
  );
}
