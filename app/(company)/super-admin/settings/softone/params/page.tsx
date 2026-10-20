import { requirePermission } from "@/lib/rbac/permissions";
import { PARAMETER_LOOKUPS } from "@/lib/softone/mapping";
import { getSoftoneParamsForEdit } from "@/app/actions/softone";
import { SoftoneHeader } from "@/components/settings/softone/SoftoneHeader";
import { SoftoneParamsClient } from "@/components/settings/softone/SoftoneParamsClient";

export const metadata = { title: "SoftOne — Παράμετροι" };
export const dynamic = "force-dynamic";

export default async function SoftoneParamsPage() {
  await requirePermission("softone-params", "view");
  const initial = await getSoftoneParamsForEdit();
  return (
    <div className="dash-page" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <SoftoneHeader title="Παράμετροι & αντιστοιχίσεις" subtitle="Τα ids της εγκατάστασης SoftOne που χρειάζεται η αντιστοίχιση: χώρα, νόμισμα, τρόποι πληρωμής, τύποι συμβάσεων, σειρές, ΦΠΑ, μονάδες." />
      <SoftoneParamsClient initial={initial} lookups={PARAMETER_LOOKUPS.map((l) => ({ key: l.key, editor: l.editor, label: l.label }))} />
    </div>
  );
}
