import { requirePermission } from "@/lib/rbac/permissions";
import { getEffectiveSession } from "@/lib/auth-effective";
import { db } from "@/lib/db";
import { HelpCenter } from "@/components/help/HelpCenter";

export const metadata = { title: "Βοήθεια & οδηγίες" };

type SP = Record<string, string | string[] | undefined>;

export default async function PortalHelpPage({ searchParams }: { searchParams?: Promise<SP> }) {
  await requirePermission("customer-help", "view");
  const [eff, sp, company] = await Promise.all([
    getEffectiveSession(),
    searchParams ?? Promise.resolve({} as SP),
    db.company.findFirst({ orderBy: { createdAt: "asc" }, select: { phone1: true, email: true } }),
  ]);
  return <HelpCenter role={eff?.user.role ?? "PROPERTY_RESIDENT"} base="/portal/help" requested={typeof sp.m === "string" ? sp.m : undefined} supportPhone={company?.phone1} supportEmail={company?.email} />;
}
