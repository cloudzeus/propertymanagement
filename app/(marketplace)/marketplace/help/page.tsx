import { db } from "@/lib/db";
import { requireCollaborator } from "@/lib/marketplace";
import { HelpCenter } from "@/components/help/HelpCenter";

export const metadata = { title: "Βοήθεια & οδηγίες" };

type SP = Record<string, string | string[] | undefined>;

export default async function MarketplaceHelpPage({ searchParams }: { searchParams?: Promise<SP> }) {
  // Help stays reachable even before the first-login wizard is completed.
  await requireCollaborator("mkt-help", "view", { allowUnonboarded: true });
  const [sp, company] = await Promise.all([
    searchParams ?? Promise.resolve({} as SP),
    db.company.findFirst({ orderBy: { createdAt: "asc" }, select: { phone1: true, email: true } }),
  ]);
  return <HelpCenter role="COLLABORATOR" base="/marketplace/help" requested={typeof sp.m === "string" ? sp.m : undefined} supportPhone={company?.phone1} supportEmail={company?.email} />;
}
