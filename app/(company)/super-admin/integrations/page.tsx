import { INTEGRATIONS, integrationStatuses } from "@/lib/integrations";
import { requirePermission } from "@/lib/rbac/permissions";
import { IntegrationsClient, type IntegrationItem } from "./IntegrationsClient";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  await requirePermission("integrations", "view");
  const statuses = integrationStatuses();
  const items: IntegrationItem[] = INTEGRATIONS.map((m) => {
    const s = statuses.find((x) => x.id === m.id)!;
    return { ...m, configured: s.configured, envPresent: s.envPresent };
  });
  return <IntegrationsClient items={items} />;
}
