import { requirePermission } from "@/lib/rbac/permissions";
import { db } from "@/lib/db";
import { PricingClient } from "./PricingClient";

export default async function PricingCmsPage() {
  await requirePermission("cms-pricing", "view");
  const tiers = await db.pricingTier.findMany({ orderBy: { order: "asc" } });
  return <PricingClient initial={JSON.parse(JSON.stringify(tiers))} />;
}
