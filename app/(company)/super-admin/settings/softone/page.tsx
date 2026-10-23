import { requirePermission } from "@/lib/rbac/permissions";
import { getSoftoneConnectionForEdit } from "@/app/actions/softone";
import { SoftoneHeader } from "@/components/settings/softone/SoftoneHeader";
import { SoftoneConnectionClient } from "@/components/settings/softone/SoftoneConnectionClient";

export const metadata = { title: "SoftOne — Σύνδεση" };
export const dynamic = "force-dynamic";

export default async function SoftoneConnectionPage() {
  await requirePermission("softone-connection", "view");
  const initial = await getSoftoneConnectionForEdit();
  return (
    <div className="dash-page" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <SoftoneHeader title="Διασύνδεση SoftOne" subtitle="Στοιχεία σύνδεσης με τα Web Services του SoftOne της Orithon, δοκιμή σύνδεσης και αυτόματος συγχρονισμός." />
      <SoftoneConnectionClient initial={initial} />
    </div>
  );
}
