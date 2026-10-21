import { requirePermission, getEffectivePermissions, can } from "@/lib/rbac/permissions";
import { RiRoadMapLine } from "react-icons/ri";
import { loadDistanceOverview } from "@/app/actions/distance-settings";
import { DistanceSettings } from "@/components/settings/DistanceSettings";

export const metadata = { title: "Σταθμός βάσης & ζώνες — Super Admin" };

export default async function DistanceSettingsPage() {
  await requirePermission("settings-distance", "view");
  const resolved = await getEffectivePermissions();
  const canEdit = !!resolved && can(resolved.perms, "settings-distance", "edit");
  const overview = await loadDistanceOverview();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 1000 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--color-primary)18", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <RiRoadMapLine style={{ fontSize: "var(--fs-20)", color: "var(--color-primary)" }} />
        </div>
        <div>
          <h1 style={{ fontSize: "var(--fs-22)", fontWeight: 700, color: "var(--foreground)", margin: 0 }}>Σταθμός βάσης & ζώνες απόστασης</h1>
          <p style={{ fontSize: "var(--fs-13)", color: "var(--muted-foreground)", marginTop: 4 }}>
            Η έδρα από την οποία μετράμε χιλιόμετρα, οι ζώνες απόστασης και η χρέωση μετάβασης τεχνικού ανά ζώνη.
          </p>
        </div>
      </div>

      <DistanceSettings overview={overview} canEdit={canEdit} />
    </div>
  );
}
