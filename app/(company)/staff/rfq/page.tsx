import { requirePermission, getEffectivePermissions, can } from "@/lib/rbac/permissions";
import { listRfqInvitationRows, listOpenFaultsForRfq } from "@/lib/rfq";
import { RfqInvitationsClient } from "./RfqInvitationsClient";

export const metadata = { title: "Αιτήματα προσφοράς" };

/** Company board of every supplier invitation (all four company roles). */
export default async function StaffRfqPage() {
  await requirePermission("rfq", "view");
  const resolved = (await getEffectivePermissions())!;
  const canCreate = can(resolved.perms, "rfq", "create");
  const [rows, faults] = await Promise.all([listRfqInvitationRows(), canCreate ? listOpenFaultsForRfq() : Promise.resolve([])]);
  return (
    <RfqInvitationsClient
      rows={rows}
      faults={faults}
      canCreate={canCreate}
      canEdit={can(resolved.perms, "rfq", "edit")}
      faultLinks={["SUPER_ADMIN", "ADMIN"].includes(resolved.role)}
    />
  );
}
