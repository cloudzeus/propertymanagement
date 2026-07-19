import { requirePermission } from "@/lib/rbac/permissions";
import { RiBankCardLine } from "react-icons/ri";
import { getProviderVivaForEdit } from "@/app/actions/provider-viva";
import { ProviderVivaSettings } from "@/components/settings/ProviderVivaSettings";

export const metadata = { title: "Πληρωμές (Viva) — Super Admin" };

export default async function PaymentsSettingsPage() {
  // Granted only to SUPER_ADMIN + ADMIN in DEFAULT_PERMISSIONS (settings-payments).
  await requirePermission("settings-payments", "view");
  const initial = await getProviderVivaForEdit();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: "var(--color-teal)18",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <RiBankCardLine style={{ fontSize: 20, color: "var(--color-teal)" }} />
        </div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--foreground)", margin: 0 }}>Πληρωμές (Viva)</h1>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 4 }}>
            Ρύθμιση του λογαριασμού Viva της πλατφόρμας για είσπραξη πληρωμών από χρήστες
          </p>
        </div>
      </div>

      <ProviderVivaSettings initial={initial} />
    </div>
  );
}
