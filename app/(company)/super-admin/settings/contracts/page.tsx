import { db } from "@/lib/db";
import { requirePermission } from "@/lib/rbac/permissions";
import { getTemplate } from "@/lib/contracts";
import { ContractsSettingsClient } from "./ContractsSettingsClient";

export const metadata = { title: "Προσφορές & συμβάσεις" };

export default async function ContractsSettingsPage() {
  await requirePermission("settings-contracts", "view");
  const [s, customer, supplier] = await Promise.all([
    db.appSettings.findUnique({ where: { id: "singleton" }, select: { offerMarkupPct: true, warrantyMonths: true, silentAcceptDays: true } }),
    getTemplate("WO_CUSTOMER"), getTemplate("WO_SUPPLIER"),
  ]);
  return (
    <ContractsSettingsClient
      settings={{ offerMarkupPct: Number(s?.offerMarkupPct ?? 15), warrantyMonths: s?.warrantyMonths ?? 6, silentAcceptDays: s?.silentAcceptDays ?? 5 }}
      templates={{ WO_CUSTOMER: customer, WO_SUPPLIER: supplier }}
    />
  );
}
