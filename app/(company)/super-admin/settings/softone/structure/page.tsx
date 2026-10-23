import { requirePermission } from "@/lib/rbac/permissions";
import { ENTITY_MAPS, PARAMETER_LOOKUPS } from "@/lib/softone/mapping";
import { getSoftoneConfig, getSoftoneSettingsRow } from "@/lib/softone/config";
import { SoftoneHeader } from "@/components/settings/softone/SoftoneHeader";
import { SoftoneStructureClient } from "@/components/settings/softone/SoftoneStructureClient";

export const metadata = { title: "SoftOne — Δομή δεδομένων & έλεγχοι" };
export const dynamic = "force-dynamic";

export default async function SoftoneStructurePage() {
  await requirePermission("softone-structure", "view");
  const [cfg, row] = await Promise.all([getSoftoneConfig().catch(() => null), getSoftoneSettingsRow()]);
  return (
    <div className="dash-page" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <SoftoneHeader title="Δομή δεδομένων & έλεγχοι" subtitle="Τι αντιστοιχεί σε τι, και αν η εγκατάσταση SoftOne έχει ό,τι απαιτεί η προδιαγραφή — μόνο με αναγνώσεις." />
      <SoftoneStructureClient
        maps={ENTITY_MAPS}
        lookups={PARAMETER_LOOKUPS.map((l) => ({ key: l.key, editor: l.editor, label: l.label }))}
        configured={cfg !== null}
        lastPing={{ at: row?.lastPingAt?.toISOString() ?? null, ok: row?.lastPingOk ?? null, message: row?.lastPingMessage ?? null }}
      />
    </div>
  );
}
